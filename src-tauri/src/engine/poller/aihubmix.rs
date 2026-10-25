use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::Read;

use super::{build_agent, PollError};
use crate::engine::diagnose;
use crate::engine::models::{CreditsSection, UsageData};

/// Documented account endpoint. `$1` is `500_000` quota units.
const PRIMARY_URL: &str = "https://aihubmix.com/api/user/self";
/// Used only when the primary host cannot be reached.
const BACKUP_URL: &str = "https://api.aihubmix.com/api/user/self";
const QUOTA_PER_DOLLAR: f64 = 500_000.0;

pub(super) fn poll_aihubmix() -> Result<UsageData, PollError> {
    let token = access_token().ok_or_else(|| {
        diagnose::log("AIHubMix balance poll failed: no system access token is saved");
        PollError::NoCredentials
    })?;
    match fetch_balance(PRIMARY_URL, &token) {
        Err(PollError::NetworkError) => fetch_balance(BACKUP_URL, &token),
        other => other,
    }
}

pub(super) fn credential_watch_snapshot(_all_sources: bool) -> Vec<String> {
    match access_token() {
        Some(token) => vec![token_signature(&token)],
        None => vec!["aihubmix:missing".into()],
    }
}

fn access_token() -> Option<String> {
    normalize_token(&crate::engine::app_settings::load_settings().aihubmix_token)
}

/// A manual cap replaces the fake ceiling of `used + balance`.
/// `total == 0` means no cap is set: the tooltip shows the balance alone,
/// and the progress percentage stays the share of `used + balance`.
/// The cached reading stays uncapped so a new limit applies before the next poll.
pub(crate) fn with_usage_limit(mut usage: UsageData, limit: f64) -> UsageData {
    let Some(credits) = usage.credits.as_mut() else {
        return usage;
    };
    let used = (credits.total - credits.remaining).max(0.0);
    if limit.is_finite() && limit > 0.0 {
        credits.total = limit;
        credits.percentage = (used / limit * 100.0).clamp(0.0, 100.0);
    } else {
        credits.total = 0.0;
    }
    usage
}

fn normalize_token(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    let token = trimmed
        .strip_prefix("Bearer ")
        .or_else(|| trimmed.strip_prefix("bearer "))
        .unwrap_or(trimmed)
        .trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

fn token_signature(token: &str) -> String {
    let mut hasher = DefaultHasher::new();
    token.hash(&mut hasher);
    format!("aihubmix:{:x}", hasher.finish())
}

fn fetch_balance(url: &str, token: &str) -> Result<UsageData, PollError> {
    let response = match build_agent()?
        .get(url)
        .header("Authorization", token)
        .header("Accept", "application/json")
        .call()
        .and_then(super::check_http_status)
    {
        Ok(response) => response,
        Err(ureq::Error::StatusCode(code @ (401 | 403))) => {
            diagnose::log(format!(
                "AIHubMix account endpoint returned auth status {code}"
            ));
            return Err(PollError::AuthRequired);
        }
        Err(ureq::Error::StatusCode(code)) => {
            diagnose::log(format!("AIHubMix account endpoint returned status {code}"));
            return Err(PollError::HttpStatus(code));
        }
        Err(error) => {
            diagnose::log_error("AIHubMix account endpoint request failed", error);
            return Err(PollError::NetworkError);
        }
    };
    let mut body = String::new();
    response
        .into_body()
        .as_reader()
        .read_to_string(&mut body)
        .map_err(|error| {
            diagnose::log_error("unable to read AIHubMix account response", error);
            PollError::UnexpectedResponse
        })?;
    usage_from_body(&body)
}

/// `quota` is the remaining balance. `used_quota` is what has already been
/// spent, when the account payload includes it. Both are quota units.
fn usage_from_body(body: &str) -> Result<UsageData, PollError> {
    let value: serde_json::Value =
        serde_json::from_str(body).map_err(|_| PollError::UnexpectedResponse)?;
    if value.get("success").and_then(serde_json::Value::as_bool) == Some(false) {
        return Err(PollError::UnexpectedResponse);
    }
    let data = value
        .get("data")
        .filter(|data| data.is_object())
        .ok_or(PollError::UnexpectedResponse)?;
    let remaining_units = json_units(data.get("quota")).ok_or(PollError::UnexpectedResponse)?;
    let used_units = json_units(data.get("used_quota")).unwrap_or(0.0);
    let remaining = remaining_units / QUOTA_PER_DOLLAR;
    let used = used_units / QUOTA_PER_DOLLAR;
    let total = remaining + used;
    let percentage = if total > 0.0 {
        (used / total * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };
    Ok(UsageData {
        credits: Some(CreditsSection {
            percentage,
            remaining,
            total,
        }),
        ..UsageData::default()
    })
}

fn json_units(value: Option<&serde_json::Value>) -> Option<f64> {
    let units = match value? {
        serde_json::Value::Number(number) => number.as_f64()?,
        serde_json::Value::String(text) => text.trim().parse().ok()?,
        _ => return None,
    };
    units
        .is_finite()
        .then_some(units)
        .filter(|units| *units >= 0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn balance_is_quota_divided_by_500000() {
        let usage = usage_from_body(
            r#"{"success":true,"data":{"username":"ada","quota":2500000,"used_quota":500000}}"#,
        )
        .unwrap();
        let credits = usage.credits.unwrap();
        assert!((credits.remaining - 5.0).abs() < 1e-9);
        assert!((credits.total - 6.0).abs() < 1e-9);
        assert!((credits.percentage - (100.0 / 6.0)).abs() < 1e-6);
        assert!(!usage.session.available);
        assert!(!usage.weekly.available);
    }

    #[test]
    fn a_manual_limit_is_the_ceiling_and_zero_leaves_the_balance() {
        let raw =
            usage_from_body(r#"{"success":true,"data":{"quota":2500000,"used_quota":500000}}"#)
                .unwrap();
        let open = with_usage_limit(raw.clone(), 0.0);
        let open_credits = open.credits.unwrap();
        assert_eq!(open_credits.remaining, 5.0);
        assert_eq!(open_credits.total, 0.0);
        assert!((open_credits.percentage - (100.0 / 6.0)).abs() < 1e-6);

        let capped = with_usage_limit(raw, 10.0).credits.unwrap();
        assert_eq!(capped.remaining, 5.0);
        assert_eq!(capped.total, 10.0);
        assert!((capped.percentage - 10.0).abs() < 1e-6);

        let over = with_usage_limit(
            usage_from_body(r#"{"success":true,"data":{"quota":0,"used_quota":6000000}}"#).unwrap(),
            10.0,
        )
        .credits
        .unwrap();
        assert_eq!(over.percentage, 100.0);
        assert_eq!(over.total, 10.0);
    }

    #[test]
    fn missing_used_quota_reports_only_the_remaining_balance() {
        let credits = usage_from_body(r#"{"success":true,"data":{"quota":500000}}"#)
            .unwrap()
            .credits
            .unwrap();
        assert_eq!(credits.remaining, 1.0);
        assert_eq!(credits.total, 1.0);
        assert_eq!(credits.percentage, 0.0);
    }

    #[test]
    fn rejected_or_incomplete_payloads_are_unexpected() {
        assert_eq!(
            usage_from_body(r#"{"success":false,"message":"无效的令牌"}"#),
            Err(PollError::UnexpectedResponse)
        );
        assert_eq!(
            usage_from_body(r#"{"success":true,"data":{}}"#),
            Err(PollError::UnexpectedResponse)
        );
    }

    #[test]
    fn bearer_prefix_is_removed_and_blank_tokens_are_absent() {
        assert_eq!(
            normalize_token("  Bearer fd-token  ").as_deref(),
            Some("fd-token")
        );
        assert_eq!(normalize_token("fd-token").as_deref(), Some("fd-token"));
        assert_eq!(normalize_token("   "), None);
    }
}
