//! `URLSearchParams` (application/x-www-form-urlencoded, WHATWG), which the
//! TypeScript port gets from the platform, spelled out so a redirect's query
//! comes out byte-identical in both ports.

/// A query string as `URLSearchParams` reads it: ordered pairs, `+` as space,
/// percent-escapes decoded (invalid UTF-8 replaced, a malformed escape kept).
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(crate) struct Query(Vec<(String, String)>);

impl Query {
	pub(crate) fn parse(raw: &str) -> Self {
		let raw = raw.strip_prefix('?').unwrap_or(raw);
		Self(
			raw.split('&')
				.filter(|pair| !pair.is_empty())
				.map(|pair| {
					let (name, value) = pair.split_once('=').unwrap_or((pair, ""));
					(form_decode(name), form_decode(value))
				})
				.collect(),
		)
	}

	pub(crate) fn new() -> Self {
		Self::default()
	}

	pub(crate) fn get(&self, name: &str) -> Option<&str> {
		self.0.iter().find_map(|(k, v)| (k == name).then_some(v.as_str()))
	}

	pub(crate) fn append(&mut self, name: &str, value: &str) {
		self.0.push((name.to_owned(), value.to_owned()));
	}

	pub(crate) fn remove(&mut self, name: &str) {
		self.0.retain(|(k, _)| k != name);
	}

	pub(crate) fn is_empty(&self) -> bool {
		self.0.is_empty()
	}
}

impl std::fmt::Display for Query {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		for (i, (name, value)) in self.0.iter().enumerate() {
			if i > 0 {
				f.write_str("&")?;
			}
			f.write_str(&form_encode(name))?;
			f.write_str("=")?;
			f.write_str(&form_encode(value))?;
		}
		Ok(())
	}
}

fn form_encode(s: &str) -> String {
	let mut out = String::with_capacity(s.len());
	for byte in s.bytes() {
		match byte {
			b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'*' | b'-' | b'.' | b'_' => out.push(char::from(byte)),
			b' ' => out.push('+'),
			_ => push_escape(&mut out, byte),
		}
	}
	out
}

fn form_decode(s: &str) -> String {
	// A `%2B` decodes to `+` after this, so it stays a plus, as it must.
	percent_decode(&s.replace('+', " "))
}

/// Percent-escapes decoded; invalid UTF-8 replaced, a malformed escape kept.
fn percent_decode(s: &str) -> String {
	let bytes = s.as_bytes();
	let mut out = Vec::with_capacity(bytes.len());
	let mut i = 0;
	while i < bytes.len() {
		match bytes[i] {
			b'%' => match (bytes.get(i + 1).and_then(hex), bytes.get(i + 2).and_then(hex)) {
				(Some(hi), Some(lo)) => {
					out.push(hi << 4 | lo);
					i += 2;
				}
				_ => out.push(b'%'),
			},
			other => out.push(other),
		}
		i += 1;
	}
	String::from_utf8_lossy(&out).into_owned()
}

fn hex(byte: &u8) -> Option<u8> {
	char::from(*byte).to_digit(16).and_then(|d| u8::try_from(d).ok())
}

fn push_escape(out: &mut String, byte: u8) {
	const HEX: &[u8; 16] = b"0123456789ABCDEF";
	out.push('%');
	out.push(char::from(HEX[usize::from(byte >> 4)]));
	out.push(char::from(HEX[usize::from(byte & 0x0f)]));
}

#[cfg(test)]
mod tests {
	use super::Query;

	#[test]
	fn reads_and_writes_a_query_as_url_search_params_does() {
		let mut query = Query::parse("?lang=en&utm_source=gbp&&q=a+b%20c&bad=%zz&lang=fr");
		assert_eq!(query.get("lang"), Some("en"));
		assert_eq!(query.get("q"), Some("a b c"));
		assert_eq!(query.get("bad"), Some("%zz"));
		query.remove("lang");
		assert_eq!(query.to_string(), "utm_source=gbp&q=a+b+c&bad=%25zz");
		assert!(Query::parse("").is_empty());
		assert_eq!(Query::parse("é=ü~").to_string(), "%C3%A9=%C3%BC%7E");
	}
}
