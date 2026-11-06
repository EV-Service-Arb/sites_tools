//! The repo's one generator: the kitstart contract the TS port reads, from the
//! Rust core. Run via `nix run .#gen`; the `generated` pre-commit hook re-runs it.

use std::path::Path;

use ev_lib::ts_gen::Ts;

fn main() {
	let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
	Ts::write(&root.join("ts/kitstart/src/generated/contract.ts"), &contract());
}

fn contract() -> Vec<Ts> {
	use kitstart::{
		AI_CRAWLERS, GONE, GONE_HEADER, HONEYPOT_FIELD, HOST_MARK, LANG_COOKIE, LANG_COOKIE_MAX_AGE, LEGACY_HONEYPOT_FIELDS, MIN_FILL_MS, NON_PAGE_ROUTES, OG_IMAGE_SIZE,
		RATE_LIMIT_OVERFLOW_KEY, RATING_MAX_AGE_DAYS, RENDERED_AT_FIELD, THANKS,
	};
	vec![
		Ts::Const {
			name: "HONEYPOT_FIELD",
			value: HONEYPOT_FIELD,
		},
		Ts::Value {
			name: "LEGACY_HONEYPOT_FIELDS",
			value: LEGACY_HONEYPOT_FIELDS.into(),
		},
		Ts::Const {
			name: "RENDERED_AT_FIELD",
			value: RENDERED_AT_FIELD,
		},
		Ts::Value {
			name: "MIN_FILL_MS",
			value: MIN_FILL_MS.into(),
		},
		Ts::Const {
			name: "RATE_LIMIT_OVERFLOW_KEY",
			value: RATE_LIMIT_OVERFLOW_KEY,
		},
		Ts::Const { name: "THANKS", value: THANKS },
		Ts::Const {
			name: "LANG_COOKIE",
			value: LANG_COOKIE,
		},
		Ts::Value {
			name: "LANG_COOKIE_MAX_AGE",
			value: LANG_COOKIE_MAX_AGE.into(),
		},
		Ts::Const {
			name: "HOST_MARK",
			value: HOST_MARK,
		},
		Ts::Const { name: "GONE", value: GONE },
		Ts::Const {
			name: "GONE_HEADER",
			value: GONE_HEADER,
		},
		Ts::Value {
			name: "NON_PAGE_ROUTES",
			value: NON_PAGE_ROUTES.as_slice().into(),
		},
		Ts::Value {
			name: "OG_IMAGE_SIZE",
			value: serde_json::json!(OG_IMAGE_SIZE),
		},
		Ts::Value {
			name: "RATING_MAX_AGE_DAYS",
			value: RATING_MAX_AGE_DAYS.into(),
		},
		Ts::Value {
			name: "AI_CRAWLERS",
			value: AI_CRAWLERS.as_slice().into(),
		},
	]
}
