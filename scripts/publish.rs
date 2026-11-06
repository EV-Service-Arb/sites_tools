#!/usr/bin/env nix
---cargo
#! nix shell --impure --expr ``
#! nix let rust_flake = builtins.getFlake ''github:oxalica/rust-overlay'';
#! nix     nixpkgs_flake = builtins.getFlake ''nixpkgs'';
#! nix     pkgs = import nixpkgs_flake {
#! nix       system = builtins.currentSystem;
#! nix       overlays = [rust_flake.overlays.default];
#! nix     };
#! nix     toolchain = pkgs.rust-bin.selectLatestNightlyWith (t: t.default);
#! nix in pkgs.mkShell {
#! nix   buildInputs = [ toolchain pkgs.nix pkgs.git pkgs.nodejs ];
#! nix }
#! nix ``
#! nix --command sh -c ``cargo -Zscript -q "$0" "$@"``

[package]
edition = "2024"

[dependencies]
serde_json = "1"
---

//! `nix run .#publish -- <major|minor|patch>`: bump `@evinvest/kitstart`, move
//! the template onto it, commit and tag. npm takes no credential from here: the
//! pushed tag runs `.github/workflows/release-npm.yml` (v_flakes `npmRelease`),
//! which publishes through trusted publishing (OIDC).

use std::process::{Command, ExitCode};

/// A non-zero exit is an answer, not a panic: once one package is on the registry
/// every later step has to be able to fail without stranding it untagged.
fn try_run(cmd: &mut Command) -> bool {
	cmd.status().expect("spawn").success()
}

fn version_of(dir: &std::path::Path) -> String {
	let json: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(dir.join("package.json")).expect("read package.json")).expect("parse package.json");
	json["version"].as_str().expect("package.json version").to_owned()
}

fn capture(cmd: &mut Command) -> String {
	let out = cmd.output().expect("spawn");
	assert!(out.status.success(), "command failed: {cmd:?}");
	String::from_utf8(out.stdout).expect("utf8").trim().to_owned()
}

fn last_tag(glob: &str) -> Option<String> {
	Command::new("git")
		.args(["describe", "--tags", "--abbrev=0", "--match", glob])
		.output()
		.ok()
		.filter(|o| o.status.success())
		.map(|o| String::from_utf8_lossy(&o.stdout).trim().to_owned())
}

/// Changed since the last `{prefix}-v*` tag, restricted to `paths` (git pathspec).
/// No such tag means never published -> treat as changed.
fn changed(prefix: &str, paths: &[&str]) -> bool {
	match last_tag(&format!("{prefix}-v*")) {
		None => true,
		Some(tag) => !Command::new("git").args(["diff", "--quiet", &tag, "--"]).args(paths).status().expect("git diff").success(),
	}
}

/// Does `range` admit `version`? The same slice of semver as
/// ts/kitstart/scripts/semver.mjs — the one check-template holds the template to:
/// `^`, `>=`, `<=`, `>`, `<`, `=`/bare, `*`, AND by space, `||`. `None` for
/// anything else, so an unreadable range is reported rather than guessed at.
fn admits(range: &str, version: &str) -> Option<bool> {
	fn parse(s: &str) -> Option<[u64; 3]> {
		let mut out = [0; 3];
		let mut parts = s.split('.');
		out[0] = parts.next()?.parse().ok()?;
		for slot in &mut out[1..] {
			if let Some(p) = parts.next() {
				*slot = p.parse().ok()?;
			}
		}
		parts.next().is_none().then_some(out)
	}
	let v = parse(version)?;
	let term = |t: &str| -> Option<bool> {
		if t.is_empty() || t == "*" {
			return Some(true);
		}
		let (op, rest) = ["^", ">=", "<=", ">", "<", "="].iter().find_map(|op| t.strip_prefix(op).map(|r| (*op, r))).unwrap_or(("", t));
		let b = parse(rest)?;
		Some(match op {
			"^" => {
				let upper = if b[0] > 0 {
					[b[0] + 1, 0, 0]
				} else if b[1] > 0 {
					[0, b[1] + 1, 0]
				} else {
					[0, 0, b[2] + 1]
				};
				v >= b && v < upper
			}
			">=" => v >= b,
			"<=" => v <= b,
			">" => v > b,
			"<" => v < b,
			_ => v == b,
		})
	};
	let mut any = false;
	for alt in range.split("||") {
		let mut all = true;
		for t in alt.split_whitespace() {
			all &= term(t)?;
		}
		any |= all;
	}
	Some(any)
}

/// Rewrite `name`'s range in a package.json text to `^version` when it does not
/// admit `version`. Textual on purpose: re-serialising would reorder keys and
/// reflow the file. `Ok(None)` when there is nothing to do.
fn bump_range(manifest: &str, name: &str, version: &str) -> Result<Option<String>, String> {
	let json: serde_json::Value = serde_json::from_str(manifest).map_err(|e| format!("parse: {e}"))?;
	let Some(range) = ["dependencies", "devDependencies"].iter().find_map(|k| json[k][name].as_str()) else {
		return Ok(None);
	};
	match admits(range, version) {
		Some(true) => return Ok(None),
		Some(false) => {}
		None => return Err(format!("cannot read the range {name}@{range}; set it to ^{version} by hand")),
	}
	let from = format!("\"{name}\": \"{range}\"");
	if manifest.matches(&from).count() != 1 {
		return Err(format!("expected exactly one `{from}`"));
	}
	Ok(Some(manifest.replacen(&from, &format!("\"{name}\": \"^{version}\""), 1)))
}

/// Point every `@evinvest/kitstart-v<x.y.z>` in `text` at `version`.
fn retag_kitstart(text: &str, version: &str) -> String {
	let marker = "@evinvest/kitstart-v";
	let mut out = String::with_capacity(text.len());
	let mut rest = text;
	while let Some(at) = rest.find(marker) {
		let (head, tail) = rest.split_at(at + marker.len());
		out.push_str(head);
		let end = tail.find(|c: char| !(c.is_ascii_digit() || c == '.')).unwrap_or(tail.len());
		let old = tail[..end].trim_end_matches('.');
		if old.is_empty() {
			rest = tail;
			continue;
		}
		out.push_str(version);
		rest = &tail[old.len()..];
	}
	out.push_str(rest);
	out
}

/// Local release tags (`<name>-v<version>`) the remote does not have. `ls_remote`
/// is `git ls-remote --tags` output, where an annotated tag also shows as `^{}`.
fn missing_tags(local: &str, ls_remote: &str) -> Vec<String> {
	let remote: std::collections::HashSet<&str> = ls_remote
		.lines()
		.filter_map(|l| l.split('\t').nth(1))
		.map(|r| r.trim_start_matches("refs/tags/").trim_end_matches("^{}"))
		.collect();
	local.lines().map(str::trim).filter(|t| !t.is_empty() && !remote.contains(t)).map(str::to_owned).collect()
}

/// The remote this branch pushes to, or why a release from here cannot push.
fn upstream_remote() -> Result<String, String> {
	let branch = Command::new("git").args(["symbolic-ref", "--short", "HEAD"]).output().expect("spawn");
	if !branch.status.success() {
		return Err("HEAD is detached; release from a branch".to_owned());
	}
	let branch = String::from_utf8_lossy(&branch.stdout).trim().to_owned();
	let remote = Command::new("git").args(["config", &format!("branch.{branch}.remote")]).output().expect("spawn");
	if !remote.status.success() {
		return Err(format!("`{branch}` has no upstream; `git push -u origin {branch}` first"));
	}
	Ok(String::from_utf8_lossy(&remote.stdout).trim().to_owned())
}

const KITSTART: &str = "@evinvest/kitstart";
const DIR: &str = "ts/kitstart";
/// The brand scaffold kitstart ships names kitstart by range and sites_tools by
/// kitstart's tag, so the release has to move both before the tarball is packed.
const TEMPLATE_MANIFEST: &str = "ts/kitstart/template/package.json";
const TAG_FILES: &[&str] = &["ts/kitstart/template/flake.nix", "ts/kitstart/README.md"];

fn main() -> ExitCode {
	let args: Vec<String> = std::env::args().skip(1).collect();
	let level = match args.as_slice() {
		[l] if ["major", "minor", "patch"].contains(&l.as_str()) => l.clone(),
		_ => {
			eprintln!("usage: publish <major|minor|patch>");
			return ExitCode::FAILURE;
		}
	};

	let root = capture(Command::new("git").args(["rev-parse", "--show-toplevel"]));
	std::env::set_current_dir(&root).expect("cd to repo root");

	let dirty = capture(Command::new("git").args(["status", "--porcelain"]));
	if !dirty.is_empty() {
		eprintln!("working tree is not clean — nothing was released:\n{dirty}");
		return ExitCode::FAILURE;
	}
	// The push is the last step; a branch behind its upstream gets it rejected
	// after the tag exists here. Find out now.
	let remote = match upstream_remote() {
		Ok(r) => r,
		Err(why) => {
			eprintln!("{why} — nothing was released.");
			return ExitCode::FAILURE;
		}
	};
	if !try_run(Command::new("git").args(["fetch", "--quiet", "--tags", &remote])) {
		eprintln!("`git fetch {remote}` failed, so whether this branch can push is unknown — nothing was released.");
		return ExitCode::FAILURE;
	}
	let behind = capture(Command::new("git").args(["rev-list", "--count", "HEAD..@{u}"]));
	if behind != "0" {
		eprintln!("this branch is {behind} commit(s) behind its upstream — nothing was released. `git pull --no-rebase`, then re-run.");
		return ExitCode::FAILURE;
	}
	if let Ok(out) = Command::new("git").args(["ls-remote", "--tags", &remote]).output()
		&& out.status.success()
	{
		let missing = missing_tags(&capture(Command::new("git").args(["tag", "-l", "*-v*"])), &String::from_utf8_lossy(&out.stdout));
		if !missing.is_empty() {
			eprintln!("!! release tags that {remote} does not have (an earlier run's push failed?):");
			eprintln!("    git push {remote} {}", missing.iter().map(|t| format!("refs/tags/{t}")).collect::<Vec<_>>().join(" "));
		}
	}

	// Brands pin `lib.mkLanding` by kitstart's tag, so `nix/` ships with kitstart.
	if !changed(KITSTART, &[DIR, "nix"]) {
		eprintln!("{KITSTART}: nothing changed since its last tag — nothing to release.");
		return ExitCode::SUCCESS;
	}

	let touched: Vec<&str> = ["ts/kitstart/package.json", "ts/kitstart/package-lock.json", TEMPLATE_MANIFEST].into_iter().chain(TAG_FILES.iter().copied()).collect();
	let restore: Vec<(&str, String)> = touched.iter().map(|f| (*f, std::fs::read_to_string(f).unwrap_or_else(|e| panic!("{f}: {e}")))).collect();
	let undo = || {
		for (path, text) in &restore {
			std::fs::write(path, text).expect("restore a file this run changed");
		}
	};

	if !try_run(Command::new("npm").arg("install").current_dir(DIR)) || !try_run(Command::new("npm").args(["version", &level, "--no-git-tag-version"]).current_dir(DIR)) {
		undo();
		eprintln!("`npm install` / `npm version` failed — nothing was released.");
		return ExitCode::FAILURE;
	}
	let version = version_of(std::path::Path::new(DIR));

	// Into the template BEFORE the pack, or the tarball ships a scaffold that
	// cannot install the very release it came in.
	let manifest = std::fs::read_to_string(TEMPLATE_MANIFEST).expect("read template manifest");
	match bump_range(&manifest, KITSTART, &version) {
		Ok(Some(next)) => std::fs::write(TEMPLATE_MANIFEST, next).expect("write template manifest"),
		Ok(None) => {}
		Err(e) => {
			undo();
			eprintln!("{TEMPLATE_MANIFEST}: {e} — nothing was released.");
			return ExitCode::FAILURE;
		}
	}
	for file in TAG_FILES {
		let text = std::fs::read_to_string(file).expect("read pin file");
		let next = retag_kitstart(&text, &version);
		if next == text {
			undo();
			eprintln!("{file}: no `{KITSTART}-v<x.y.z>` pin to move — nothing was released.");
			return ExitCode::FAILURE;
		}
		std::fs::write(file, next).expect("write pin file");
	}

	if !try_run(Command::new("npm").args(["publish", "--dry-run"]).current_dir(DIR)) {
		undo();
		eprintln!("`npm publish --dry-run` failed — nothing was released.");
		return ExitCode::FAILURE;
	}

	let tag = format!("{KITSTART}-v{version}");
	let committed = try_run(Command::new("git").arg("add").arg("--").args(&touched)) && try_run(Command::new("git").args(["commit", "-m", "release: npm packages", "-m", &tag]));
	if !committed || !try_run(Command::new("git").args(["tag", "-a", &tag, "-m", &tag])) {
		eprintln!("!! the release commit or tag failed. Finish by hand: commit {}, `git tag -a {tag} -m {tag}`, push both.", touched.join(" "));
		return ExitCode::FAILURE;
	}
	if !(try_run(Command::new("git").arg("push")) && try_run(Command::new("git").args(["push", &remote, &format!("refs/tags/{tag}")]))) {
		eprintln!("!! the push failed; the release commit and {tag} exist HERE ONLY:");
		eprintln!("    git pull --no-rebase && git push && git push {remote} refs/tags/{tag}");
		return ExitCode::FAILURE;
	}
	println!(">> pushed {tag}; .github/workflows/release-npm.yml publishes it. Watch: gh run list -w release-npm");
	ExitCode::SUCCESS
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn admits_the_ranges_the_template_uses() {
		assert_eq!(admits("^0.22.0", "0.22.5"), Some(true));
		assert_eq!(admits("^0.22.0", "0.23.0"), Some(false));
		assert_eq!(admits("^0.0.3", "0.0.4"), Some(false));
		assert_eq!(admits(">=0.22.0 <1", "0.23.0"), Some(true));
		assert_eq!(admits("^0.3.0 || ^0.4.0", "0.4.1"), Some(true));
		assert_eq!(admits("~0.4.0", "0.4.0"), None);
	}

	#[test]
	fn the_real_template_moves_one_line() {
		let real = include_str!("../ts/kitstart/template/package.json");
		let next = bump_range(real, KITSTART, "99.0.0").unwrap().expect("kitstart in the template");
		let changed: Vec<_> = real.lines().zip(next.lines()).filter(|(a, b)| a != b).collect();
		assert_eq!(changed.len(), 1, "{changed:?}");
		for file in [include_str!("../ts/kitstart/template/flake.nix"), include_str!("../ts/kitstart/README.md")] {
			let next = retag_kitstart(file, "99.0.0");
			assert_eq!(next.lines().zip(file.lines()).filter(|(a, b)| a != b).count(), 1);
			assert!(next.contains("@evinvest/kitstart-v99.0.0\""));
		}
	}

	#[test]
	fn finds_tags_the_remote_lacks() {
		let remote = "abc\trefs/tags/@evinvest/kitstart-v0.23.0\nabd\trefs/tags/@evinvest/kitstart-v0.23.0^{}\n";
		assert_eq!(missing_tags("@evinvest/kitstart-v0.23.0\n@evinvest/kitstart-v0.24.0\n", remote), vec!["@evinvest/kitstart-v0.24.0"]);
	}

	#[test]
	fn retags_every_kitstart_reference() {
		let text = "ref=@evinvest/kitstart-v0.3.0\";\n`@evinvest/kitstart-vX.Y.Z` tag.\n";
		assert_eq!(retag_kitstart(text, "0.4.0"), "ref=@evinvest/kitstart-v0.4.0\";\n`@evinvest/kitstart-vX.Y.Z` tag.\n");
	}
}
