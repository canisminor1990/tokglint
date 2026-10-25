//! Grok Bot quota, read with the short-lived access token the signed-in desktop
//! app keeps in its Chromium profile. The refresh token is deliberately never
//! deserialised: Grok Bot remains the sole owner of renewal.
//!
//! The request shape follows the desktop app's `GetSandUsageStatus` call, as
//! documented by the usage reader in JoshuaWang2211/ai-quota-deck.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;

use super::{unix_to_system_time, PollError};
use crate::engine::diagnose;
use crate::engine::models::{CreditsSection, UsageData, UsageSection};

const USAGE_URL: &str = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetSandUsageStatus";
const CURRENT_PERIOD_URL: &str =
    "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage";
const HARD_LIMIT_URL: &str = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetHardLimit";
/// Cursor uses this sentinel for an uncapped on-demand allowance.
const UNLIMITED_SPEND_LIMIT: i64 = 2_147_483_647;
/// Used when the installed app version cannot be overridden.
const FALLBACK_CLIENT_VERSION: &str = "0.29.0";
const PROFILE_ENV: &str = "GROK_BOT_PROFILE";
const CLIENT_VERSION_ENV: &str = "GROK_BOT_CLIENT_VERSION";

#[derive(Deserialize)]
struct SecretsFile {
    #[serde(rename = "cursor-machine-id")]
    machine_id: String,
    #[serde(rename = "cursor-accounts")]
    accounts: AccountsField,
}

/// `sand-secrets.json` stores the account list either as a JSON string or as
/// an object. Only the active access token is read from it.
#[derive(Deserialize)]
#[serde(untagged)]
enum AccountsField {
    Text(String),
    Inline(Accounts),
}

#[derive(Deserialize)]
struct Accounts {
    active: String,
    accounts: HashMap<String, Account>,
}

#[derive(Deserialize)]
struct Account {
    #[serde(rename = "cursor-access-token")]
    access_token: String,
}

#[derive(Deserialize)]
struct JwtClaims {
    exp: Option<i64>,
}

struct Credentials {
    access_token: String,
    machine_id: String,
}

#[derive(Default, Debug, PartialEq)]
struct UsageStatus {
    current_period_start: Option<i64>,
    next_reset: Option<i64>,
    usage_percent: Option<f64>,
    included_limit_zero: Option<bool>,
    uses_pooled_enterprise_allowance: Option<bool>,
    has_non_zero_included_limit: Option<bool>,
    plan_label: Option<String>,
}

pub(super) fn poll_grok_bot() -> Result<UsageData, PollError> {
    let profile = profile_dir().ok_or_else(|| {
        diagnose::log("Grok Bot usage poll failed: roaming profile directory is unavailable");
        PollError::NoCredentials
    })?;
    let state_path = profile.join("Local State");
    let secrets_path = profile.join("sand-secrets.json");
    if !state_path.is_file() || !secrets_path.is_file() {
        diagnose::log(
            "Grok Bot usage poll failed: no Grok Bot sign-in found (open the Grok Bot desktop app and sign in)",
        );
        return Err(PollError::NoCredentials);
    }

    let credentials = load_credentials(&state_path, &secrets_path)?;
    if jwt_exp(&credentials.access_token).is_some_and(|expiry| expiry <= unix_now()) {
        diagnose::log(
            "Grok Bot access token has expired; open Grok Bot so it can renew the session",
        );
        return Err(PollError::TokenExpired);
    }
    fetch_usage(&credentials)
}

pub(super) fn credential_watch_snapshot(_all_sources: bool) -> Vec<String> {
    let Some(profile) = profile_dir() else {
        return vec!["grok_bot:profile-missing".into()];
    };
    vec![
        path_signature("grok_bot_state", &profile.join("Local State")),
        path_signature("grok_bot_secrets", &profile.join("sand-secrets.json")),
    ]
}

fn profile_dir() -> Option<PathBuf> {
    if let Some(configured) = non_empty_environment(PROFILE_ENV) {
        return crate::engine::accounts::expand_path(Path::new(&configured));
    }
    Some(crate::engine::known_folders::roaming_app_data_dir()?.join("Grok Bot"))
}

fn load_credentials(state_path: &Path, secrets_path: &Path) -> Result<Credentials, PollError> {
    let key = super::claude_desktop::os_crypt_key(state_path).ok_or_else(|| {
        diagnose::log(format!(
            "unable to unlock the Grok Bot profile at {}",
            state_path.display()
        ));
        PollError::TokenExpired
    })?;
    let secrets = std::fs::read_to_string(secrets_path).map_err(|error| {
        diagnose::log_error(
            &format!(
                "unable to read Grok Bot credentials at {}",
                secrets_path.display()
            ),
            error,
        );
        PollError::NoCredentials
    })?;
    let secrets: SecretsFile = serde_json::from_str(&secrets).map_err(|error| {
        diagnose::log(format!(
            "Grok Bot sign-in record has an unexpected shape: {error}"
        ));
        PollError::UnexpectedResponse
    })?;
    let accounts = match secrets.accounts {
        AccountsField::Inline(accounts) => accounts,
        AccountsField::Text(text) => serde_json::from_str(&text).map_err(|error| {
            diagnose::log(format!(
                "Grok Bot account list could not be parsed: {error}"
            ));
            PollError::UnexpectedResponse
        })?,
    };
    let active = accounts.accounts.get(&accounts.active).ok_or_else(|| {
        diagnose::log("Grok Bot's active account is missing from its sign-in record");
        PollError::NoCredentials
    })?;
    let access_token = decrypt_text(&active.access_token, &key, "access token")?;
    let machine_id = decrypt_text(&secrets.machine_id, &key, "machine id")?;
    if !header_safe(&access_token) || !header_safe(&machine_id) {
        diagnose::log("Grok Bot's decrypted sign-in record is not usable as a request header");
        return Err(PollError::UnexpectedResponse);
    }
    Ok(Credentials {
        access_token,
        machine_id,
    })
}

fn decrypt_text(encoded: &str, key: &[u8], subject: &str) -> Result<String, PollError> {
    let plaintext =
        super::claude_desktop::decrypt_os_crypt_value(encoded, key).ok_or_else(|| {
            diagnose::log(format!("unable to decrypt the Grok Bot {subject}"));
            PollError::TokenExpired
        })?;
    String::from_utf8(plaintext).map_err(|_| {
        diagnose::log(format!("decrypted Grok Bot {subject} is not text"));
        PollError::UnexpectedResponse
    })
}

fn post_proto(credentials: &Credentials, url: &str) -> Result<Vec<u8>, PollError> {
    let checksum = checksum_at(&credentials.machine_id, unix_millis());
    let request_id = request_id();
    let version = client_version();
    let response = super::build_agent()?
        .post(url)
        .header(
            "Authorization",
            &format!("Bearer {}", credentials.access_token),
        )
        .header("Content-Type", "application/proto")
        .header("connect-protocol-version", "1")
        .header("x-cursor-checksum", &checksum)
        .header("x-cursor-client-type", "sand")
        .header("x-cursor-client-version", &version)
        .header("x-sand-box-namespace", "prod")
        .header("x-ghost-mode", "true")
        .header("x-request-id", &request_id)
        .send(())
        .and_then(super::check_http_status);
    let mut response = match response {
        Ok(response) => response,
        Err(ureq::Error::StatusCode(code @ (401 | 403))) => {
            diagnose::log(format!(
                "Grok Bot usage service rejected the saved access token with status {code}"
            ));
            return Err(PollError::TokenExpired);
        }
        Err(ureq::Error::StatusCode(code)) => {
            diagnose::log(format!("Grok Bot usage service returned status {code}"));
            return Err(PollError::HttpStatus(code));
        }
        Err(error) => {
            diagnose::log_error("Grok Bot usage request failed", error);
            return Err(PollError::NetworkError);
        }
    };
    response.body_mut().read_to_vec().map_err(|error| {
        diagnose::log_error("unable to read the Grok Bot usage response", error);
        PollError::NetworkError
    })
}

fn fetch_usage(credentials: &Credentials) -> Result<UsageData, PollError> {
    let bytes = post_proto(credentials, USAGE_URL)?;
    let status = parse_usage_status(&bytes).map_err(|error| {
        diagnose::log(format!(
            "unable to parse the Grok Bot usage response: {error}"
        ));
        PollError::UnexpectedResponse
    })?;
    if let Some(plan) = status.plan_label.as_deref() {
        diagnose::log(format!("Grok Bot plan: {plan}"));
    }
    let mut usage = usage_from_status(status)?;
    if let Some(spend) = fetch_on_demand(credentials) {
        apply_on_demand(&mut usage, spend);
    }
    Ok(usage)
}

/// The desktop app's second card: on-demand dollars billed through Cursor for
/// the current month. A failure here leaves the weekly allowance visible.
fn fetch_on_demand(credentials: &Credentials) -> Option<OnDemandSpend> {
    let bytes = match post_proto(credentials, CURRENT_PERIOD_URL) {
        Ok(bytes) => bytes,
        Err(error) => {
            diagnose::log(format!(
                "Grok Bot on-demand usage is unavailable: {error:?}"
            ));
            return None;
        }
    };
    let mut spend = match parse_current_period(&bytes) {
        Ok(spend) => spend,
        Err(error) => {
            diagnose::log(format!("unable to parse Grok Bot on-demand usage: {error}"));
            return None;
        }
    };
    if spend.limit_cents.is_none() {
        spend.limit_cents = fetch_hard_limit_cents(credentials);
    }
    let Some(limit) = spend.limit_cents.filter(|limit| *limit > 0) else {
        return None;
    };
    diagnose::log(format!(
        "Grok Bot on-demand: {:.2} / {:.2} USD",
        spend.used_cents.max(0) as f64 / 100.0,
        limit as f64 / 100.0
    ));
    Some(OnDemandSpend {
        used_cents: spend.used_cents,
        limit_cents: limit,
        reset_unix: spend.reset_unix,
    })
}

fn fetch_hard_limit_cents(credentials: &Credentials) -> Option<i64> {
    let bytes = post_proto(credentials, HARD_LIMIT_URL).ok()?;
    let (dollars, disabled) = parse_hard_limit(&bytes).ok()?;
    if disabled || dollars <= 0 || dollars >= UNLIMITED_SPEND_LIMIT {
        return None;
    }
    dollars.checked_mul(100)
}

fn apply_on_demand(usage: &mut UsageData, spend: OnDemandSpend) {
    let total = spend.limit_cents as f64 / 100.0;
    let used = (spend.used_cents.max(0) as f64 / 100.0).min(total);
    if !total.is_finite() || total <= 0.0 || !used.is_finite() {
        return;
    }
    let percentage = (used / total * 100.0).clamp(0.0, 100.0);
    usage.credits = Some(CreditsSection {
        percentage,
        remaining: (total - used).max(0.0),
        total,
    });
    usage.monthly = Some(UsageSection {
        available: true,
        percentage,
        resets_at: unix_to_system_time(spend.reset_unix),
    });
}

struct OnDemandSpend {
    used_cents: i64,
    limit_cents: i64,
    reset_unix: Option<i64>,
}

struct PeriodSpend {
    used_cents: i64,
    limit_cents: Option<i64>,
    reset_unix: Option<i64>,
}

fn usage_from_status(status: UsageStatus) -> Result<UsageData, PollError> {
    if status.uses_pooled_enterprise_allowance == Some(true) {
        diagnose::log(
            "Grok Bot uses a pooled enterprise allowance that does not report an individual percentage",
        );
        return Err(PollError::UnexpectedResponse);
    }
    if status.included_limit_zero == Some(true)
        || (status.has_non_zero_included_limit == Some(false) && status.usage_percent.is_none())
    {
        diagnose::log("Grok Bot account reports no included usage limit");
        return Err(PollError::UnexpectedResponse);
    }
    let Some(percentage) = status
        .usage_percent
        .filter(|value| value.is_finite() && (0.0..=100.0).contains(value))
    else {
        diagnose::log("Grok Bot did not report an individual weekly usage percentage");
        return Err(PollError::UnexpectedResponse);
    };
    Ok(UsageData {
        session: UsageSection::default(),
        weekly: UsageSection {
            available: true,
            percentage,
            resets_at: unix_to_system_time(status.next_reset),
        },
        ..Default::default()
    })
}

fn client_version() -> String {
    non_empty_environment(CLIENT_VERSION_ENV)
        .filter(|value| header_safe(value))
        .unwrap_or_else(|| FALLBACK_CLIENT_VERSION.to_string())
}

fn checksum_at(machine_id: &str, epoch_millis: i64) -> String {
    // Reproduces Grok Bot's six JavaScript signed-shift bytes exactly.
    let bucket = epoch_millis.div_euclid(1_000_000) as u32;
    let mut bytes = [
        (bucket >> 8) as u8,
        bucket as u8,
        (bucket >> 24) as u8,
        (bucket >> 16) as u8,
        (bucket >> 8) as u8,
        bucket as u8,
    ];
    let mut state = 165_u8;
    for (index, byte) in bytes.iter_mut().enumerate() {
        *byte = (*byte ^ state).wrapping_add(index as u8);
        state = *byte;
    }
    format!("{}{machine_id}", base64_url_encode(&bytes))
}

fn request_id() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or(0);
    let pid = u128::from(std::process::id());
    let value = now ^ (pid << 64) ^ now.wrapping_mul(0x9E37_79B9_7F4A_7C15);
    let hex = format!("{value:032x}");
    format!(
        "{}-{}-4{}-a{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[13..16],
        &hex[17..20],
        &hex[20..32]
    )
}

fn jwt_exp(token: &str) -> Option<i64> {
    let payload = token.split('.').nth(1)?;
    let bytes = base64_url_decode(payload)?;
    serde_json::from_slice::<JwtClaims>(&bytes).ok()?.exp
}

fn read_varint(bytes: &[u8], cursor: &mut usize) -> Result<u64, String> {
    let mut value = 0_u64;
    for shift in (0..64).step_by(7) {
        let byte = *bytes.get(*cursor).ok_or("truncated protobuf varint")?;
        *cursor += 1;
        let bits = u64::from(byte & 0x7f);
        if shift == 63 && bits > 1 {
            return Err("protobuf varint is too long".into());
        }
        value |= bits << shift;
        if byte & 0x80 == 0 {
            return Ok(value);
        }
    }
    Err("protobuf varint is too long".into())
}

fn length_delimited<'a>(bytes: &'a [u8], cursor: &mut usize) -> Result<&'a [u8], String> {
    let length = usize::try_from(read_varint(bytes, cursor)?)
        .map_err(|_| "protobuf field is too large".to_string())?;
    let end = cursor
        .checked_add(length)
        .ok_or("protobuf field length overflow")?;
    let field = bytes.get(*cursor..end).ok_or("truncated protobuf field")?;
    *cursor = end;
    Ok(field)
}

fn skip_field(bytes: &[u8], cursor: &mut usize, wire: u64) -> Result<(), String> {
    match wire {
        0 => {
            read_varint(bytes, cursor)?;
        }
        1 => *cursor = cursor.checked_add(8).ok_or("protobuf field overflow")?,
        2 => {
            length_delimited(bytes, cursor)?;
        }
        5 => *cursor = cursor.checked_add(4).ok_or("protobuf field overflow")?,
        _ => return Err(format!("unsupported protobuf wire type {wire}")),
    }
    if *cursor > bytes.len() {
        return Err("truncated protobuf field".into());
    }
    Ok(())
}

fn timestamp_seconds(bytes: &[u8]) -> Result<i64, String> {
    let mut cursor = 0;
    let mut seconds = None;
    while cursor < bytes.len() {
        let key = read_varint(bytes, &mut cursor)?;
        let (field, wire) = (key >> 3, key & 7);
        if field == 1 && wire == 0 {
            seconds = Some(
                i64::try_from(read_varint(bytes, &mut cursor)?)
                    .map_err(|_| "protobuf timestamp is out of range")?,
            );
        } else {
            skip_field(bytes, &mut cursor, wire)?;
        }
    }
    seconds.ok_or_else(|| "protobuf timestamp has no seconds".into())
}

fn optional_text(bytes: &[u8]) -> Option<String> {
    String::from_utf8(bytes.to_vec())
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn parse_usage_status(bytes: &[u8]) -> Result<UsageStatus, String> {
    let mut result = UsageStatus::default();
    let mut cursor = 0;
    while cursor < bytes.len() {
        let key = read_varint(bytes, &mut cursor)?;
        let (field, wire) = (key >> 3, key & 7);
        match (field, wire) {
            (1, 2) => {
                result.current_period_start =
                    Some(timestamp_seconds(length_delimited(bytes, &mut cursor)?)?)
            }
            (2, 2) => {
                result.next_reset = Some(timestamp_seconds(length_delimited(bytes, &mut cursor)?)?)
            }
            (3, 1) => {
                let raw: [u8; 8] = bytes
                    .get(cursor..cursor + 8)
                    .ok_or("truncated usage percentage")?
                    .try_into()
                    .map_err(|_| "invalid usage percentage")?;
                result.usage_percent = Some(f64::from_le_bytes(raw));
                cursor += 8;
            }
            (4, 0) => result.included_limit_zero = Some(read_varint(bytes, &mut cursor)? != 0),
            (6, 0) => {
                result.uses_pooled_enterprise_allowance =
                    Some(read_varint(bytes, &mut cursor)? != 0)
            }
            (8, 0) => {
                result.has_non_zero_included_limit = Some(read_varint(bytes, &mut cursor)? != 0)
            }
            (15, 2) => result.plan_label = optional_text(length_delimited(bytes, &mut cursor)?),
            _ => skip_field(bytes, &mut cursor, wire)?,
        }
    }
    Ok(result)
}

fn parse_current_period(bytes: &[u8]) -> Result<PeriodSpend, String> {
    let mut result = PeriodSpend {
        used_cents: 0,
        limit_cents: None,
        reset_unix: None,
    };
    let mut cursor = 0;
    while cursor < bytes.len() {
        let key = read_varint(bytes, &mut cursor)?;
        let (field, wire) = (key >> 3, key & 7);
        match (field, wire) {
            (2, 0) => {
                result.reset_unix = epoch_seconds(read_varint(bytes, &mut cursor)?);
            }
            (4, 2) => {
                let nested = length_delimited(bytes, &mut cursor)?;
                let (used, limit) = parse_spend_limit(nested)?;
                result.used_cents = used;
                result.limit_cents = limit;
            }
            _ => skip_field(bytes, &mut cursor, wire)?,
        }
    }
    Ok(result)
}

fn parse_spend_limit(bytes: &[u8]) -> Result<(i64, Option<i64>), String> {
    let mut used = 0_i64;
    let mut limit = None;
    let mut cursor = 0;
    while cursor < bytes.len() {
        let key = read_varint(bytes, &mut cursor)?;
        let (field, wire) = (key >> 3, key & 7);
        match (field, wire) {
            (5, 0) => limit = bounded_cents(read_varint(bytes, &mut cursor)?),
            (6, 0) => used = bounded_cents(read_varint(bytes, &mut cursor)?).unwrap_or(0),
            _ => skip_field(bytes, &mut cursor, wire)?,
        }
    }
    Ok((used, limit))
}

fn parse_hard_limit(bytes: &[u8]) -> Result<(i64, bool), String> {
    let mut dollars = 0_i64;
    let mut disabled = false;
    let mut cursor = 0;
    while cursor < bytes.len() {
        let key = read_varint(bytes, &mut cursor)?;
        let (field, wire) = (key >> 3, key & 7);
        match (field, wire) {
            (1, 0) => {
                dollars = i64::try_from(read_varint(bytes, &mut cursor)?)
                    .map_err(|_| "hard limit is out of range".to_string())?;
            }
            (2, 0) => disabled = read_varint(bytes, &mut cursor)? != 0,
            _ => skip_field(bytes, &mut cursor, wire)?,
        }
    }
    Ok((dollars, disabled))
}

fn bounded_cents(value: u64) -> Option<i64> {
    let cents = i64::try_from(value).ok()?;
    (cents > 0 && cents < UNLIMITED_SPEND_LIMIT).then_some(cents)
}

/// `billing_cycle_end` is a millisecond timestamp in the desktop app. Older
/// payloads that already use epoch seconds still resolve.
fn epoch_seconds(value: u64) -> Option<i64> {
    let value = i64::try_from(value).ok()?;
    if value <= 0 {
        return None;
    }
    let seconds = if value > 10_000_000_000 {
        value / 1000
    } else {
        value
    };
    Some(seconds)
}

fn header_safe(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|byte| (0x20..0x7f).contains(&byte))
}

fn non_empty_environment(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn path_signature(kind: &str, path: &Path) -> String {
    match std::fs::metadata(path) {
        Ok(metadata) => {
            let modified = metadata
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .map(|value| value.as_secs())
                .unwrap_or(0);
            format!(
                "{kind}:{}|present|{}|{modified}",
                path.display(),
                metadata.len()
            )
        }
        Err(_) => format!("{kind}:{}|missing", path.display()),
    }
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs() as i64)
        .unwrap_or(0)
}

fn unix_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

fn base64_url_encode(input: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut output = String::with_capacity(input.len().div_ceil(3) * 4);
    let mut index = 0;
    while index + 3 <= input.len() {
        let packed = (u32::from(input[index]) << 16)
            | (u32::from(input[index + 1]) << 8)
            | u32::from(input[index + 2]);
        for shift in [18, 12, 6, 0] {
            output.push(ALPHABET[((packed >> shift) & 63) as usize] as char);
        }
        index += 3;
    }
    if index < input.len() {
        let mut packed = u32::from(input[index]) << 16;
        if index + 1 < input.len() {
            packed |= u32::from(input[index + 1]) << 8;
        }
        output.push(ALPHABET[((packed >> 18) & 63) as usize] as char);
        output.push(ALPHABET[((packed >> 12) & 63) as usize] as char);
        if index + 1 < input.len() {
            output.push(ALPHABET[((packed >> 6) & 63) as usize] as char);
        }
    }
    output
}

fn base64_url_decode(input: &str) -> Option<Vec<u8>> {
    if input.len() % 4 == 1 {
        return None;
    }
    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    let mut buffer = 0u32;
    let mut bits = 0u32;
    for byte in input.bytes() {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'-' => 62,
            b'_' => 63,
            _ => return None,
        } as u32;
        buffer = (buffer << 6) | value;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push(((buffer >> bits) & 0xff) as u8);
        }
    }
    let padding_mask = (1u32 << bits).saturating_sub(1);
    (buffer & padding_mask == 0).then_some(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn varint(mut value: u64) -> Vec<u8> {
        let mut bytes = Vec::new();
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            bytes.push(byte);
            if value == 0 {
                return bytes;
            }
        }
    }

    fn field_varint(field: u64, value: u64) -> Vec<u8> {
        let mut bytes = varint(field << 3);
        bytes.extend(varint(value));
        bytes
    }

    fn field_bytes(field: u64, value: &[u8]) -> Vec<u8> {
        let mut bytes = varint((field << 3) | 2);
        bytes.extend(varint(value.len() as u64));
        bytes.extend(value);
        bytes
    }

    fn timestamp(value: i64) -> Vec<u8> {
        field_varint(1, value as u64)
    }

    #[test]
    fn parses_the_weekly_usage_response_without_account_data() {
        let mut bytes = field_bytes(1, &timestamp(1_787_500_000));
        bytes.extend(field_bytes(2, &timestamp(1_788_104_800)));
        bytes.extend(varint((3 << 3) | 1));
        bytes.extend(5.933123_f64.to_le_bytes());
        bytes.extend(field_varint(7, 1));
        bytes.extend(field_varint(8, 1));
        bytes.extend(field_bytes(14, b"supergrok"));
        bytes.extend(field_bytes(15, b"SuperGrok"));
        bytes.extend(field_bytes(20, b"future"));

        let parsed = parse_usage_status(&bytes).unwrap();
        assert_eq!(parsed.current_period_start, Some(1_787_500_000));
        assert_eq!(parsed.next_reset, Some(1_788_104_800));
        assert_eq!(parsed.usage_percent, Some(5.933123));
        assert_eq!(parsed.plan_label.as_deref(), Some("SuperGrok"));
        assert_eq!(parsed.has_non_zero_included_limit, Some(true));

        let usage = usage_from_status(parsed).unwrap();
        assert!(!usage.session.available);
        assert!(usage.weekly.available);
        assert!(usage.credits.is_none());
        assert!(usage.monthly.is_none());
        assert_eq!(usage.weekly.percentage, 5.933123);
        assert_eq!(
            usage.weekly.resets_at,
            unix_to_system_time(Some(1_788_104_800))
        );
    }

    #[test]
    fn on_demand_cents_become_a_dollar_allowance_even_when_nothing_is_spent() {
        let mut spend = field_varint(5, 10_000);
        spend.extend(field_varint(6, 0));
        spend.extend(field_varint(9, 10_000));
        let mut period = field_varint(2, 1_793_162_114_000);
        period.extend(field_bytes(4, &spend));
        period.extend(field_varint(6, 1));

        let parsed = parse_current_period(&period).unwrap();
        assert_eq!(parsed.used_cents, 0);
        assert_eq!(parsed.limit_cents, Some(10_000));
        assert_eq!(parsed.reset_unix, Some(1_793_162_114));

        let mut usage = UsageData {
            weekly: UsageSection {
                available: true,
                percentage: 76.0,
                resets_at: None,
            },
            ..UsageData::default()
        };
        apply_on_demand(
            &mut usage,
            OnDemandSpend {
                used_cents: parsed.used_cents,
                limit_cents: parsed.limit_cents.unwrap(),
                reset_unix: parsed.reset_unix,
            },
        );
        let credits = usage.credits.expect("a fixed cap is shown at zero spend");
        assert_eq!(credits.total, 100.0);
        assert_eq!(credits.remaining, 100.0);
        assert_eq!(credits.percentage, 0.0);
        assert_eq!(usage.weekly.percentage, 76.0);
        assert_eq!(
            usage.monthly.unwrap().resets_at,
            unix_to_system_time(Some(1_793_162_114))
        );

        let (dollars, disabled) = parse_hard_limit(&field_varint(1, 100)).unwrap();
        assert_eq!(dollars, 100);
        assert!(!disabled);
        assert!(
            parse_hard_limit(&{
                let mut bytes = field_varint(1, 100);
                bytes.extend(field_varint(2, 1));
                bytes
            })
            .unwrap()
            .1
        );
    }

    #[test]
    fn percentage_is_usable_when_the_advisory_nonzero_flag_is_absent() {
        let status = UsageStatus {
            usage_percent: Some(0.0),
            next_reset: Some(2_000),
            current_period_start: Some(1_000),
            ..UsageStatus::default()
        };
        let usage = usage_from_status(status).unwrap();
        assert_eq!(usage.weekly.percentage, 0.0);
        assert!(usage.weekly.available);
    }

    #[test]
    fn pooled_and_empty_allowances_are_not_reported_as_zero() {
        assert!(usage_from_status(UsageStatus {
            uses_pooled_enterprise_allowance: Some(true),
            usage_percent: Some(10.0),
            ..UsageStatus::default()
        })
        .is_err());
        assert!(usage_from_status(UsageStatus {
            included_limit_zero: Some(true),
            usage_percent: Some(0.0),
            ..UsageStatus::default()
        })
        .is_err());
        assert!(usage_from_status(UsageStatus::default()).is_err());
    }

    #[test]
    fn checksum_is_stable_inside_one_server_bucket() {
        assert_eq!(
            checksum_at("machine", 1_800_000_000_000),
            checksum_at("machine", 1_800_000_999_999)
        );
        assert_ne!(
            checksum_at("machine", 1_800_000_000_000),
            checksum_at("machine", 1_800_001_000_000)
        );
        assert!(checksum_at("machine", 1_800_000_000_000).ends_with("machine"));
    }

    #[test]
    fn reads_a_jwt_expiry_and_rejects_header_values() {
        let payload = base64_url_encode(br#"{"exp":10}"#);
        assert_eq!(jwt_exp(&format!("e30.{payload}.e30")), Some(10));
        assert!(jwt_exp("not-a-jwt").is_none());
        assert!(!header_safe("token\r\nX-Injected: 1"));
        assert!(!header_safe(""));
        assert!(header_safe("machine-id"));
    }
}
