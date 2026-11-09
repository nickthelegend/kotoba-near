use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{self, Read, Write};

#[derive(Deserialize)]
struct Input { source_url: String, phrase: String, code_hash: String }
#[derive(Serialize)]
struct Output { count: u32, transcript_sha256: String, source_url: String, code_hash: String }

fn main() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(not(target_arch = "wasm32"))]
    if std::env::args().nth(1).as_deref() == Some("--extract-official-fixture") {
        let path = std::env::args().nth(2).ok_or("fixture path required")?;
        if !path.ends_with("FOMCpresconf20260128.pdf") { return Err("unsupported fixture".into()); }
        let pdf = std::fs::read(path)?;
        let doc = lopdf::Document::load_mem(&pdf)?;
        let pages: Vec<u32> = doc.get_pages().keys().copied().collect();
        print!("{}", doc.extract_text(&pages)?);
        return Ok(());
    }
    let mut input_json = String::new();
    io::stdin().read_to_string(&mut input_json)?;
    let input: Input = serde_json::from_str(&input_json)?;
    if !valid_source(&input.source_url) || !valid_phrase(&input.phrase) { return Err("unsupported source or phrase".into()); }
    let pdf = download(&input.source_url)?;
    if !pdf.starts_with(b"%PDF") { return Err("source did not return PDF".into()); }
    let hash = format!("{:x}", Sha256::digest(&pdf));
    let count = count_pdf(&pdf, &input.phrase)?;
    let output = Output { count, transcript_sha256: hash, source_url: input.source_url, code_hash: input.code_hash };
    print!("{}", serde_json::to_string(&output)?);
    io::stdout().flush()?;
    Ok(())
}

#[cfg(target_arch = "wasm32")]
fn download(url: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    use std::time::Duration;
    let response = wasi_http_client::Client::new().get(url).connect_timeout(Duration::from_secs(20)).send()?;
    if response.status() != 200 { return Err(format!("official source HTTP {}", response.status()).into()); }
    Ok(response.body()?)
}
#[cfg(not(target_arch = "wasm32"))]
fn download(url: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Native fixture mode is only for reproducing a previously downloaded official PDF.
    let fixture = std::env::var("KOTOBA_OFFICIAL_PDF_FIXTURE")?;
    if !fixture.ends_with("FOMCpresconf20260128.pdf") || !url.ends_with("FOMCpresconf20260128.pdf") { return Err("fixture and URL mismatch".into()); }
    Ok(std::fs::read(fixture)?)
}

fn valid_source(s: &str) -> bool {
    let prefix = "https://www.federalreserve.gov/mediacenter/files/FOMCpresconf";
    s.strip_prefix(prefix).and_then(|tail| tail.strip_suffix(".pdf")).is_some_and(|date| date.len() == 8 && date.bytes().all(|b| b.is_ascii_digit()))
}
fn valid_phrase(s: &str) -> bool { !s.is_empty() && s.len() <= 40 && s.bytes().all(|b| b.is_ascii_alphabetic() || b == b' ') && !s.starts_with(' ') && !s.ends_with(' ') }

fn count_pdf(pdf: &[u8], phrase: &str) -> Result<u32, Box<dyn std::error::Error>> {
    let doc = lopdf::Document::load_mem(pdf)?;
    let pages: Vec<u32> = doc.get_pages().keys().copied().collect();
    let text = doc.extract_text(&pages)?;
    Ok(count_words(&text, phrase))
}
fn count_words(text: &str, phrase: &str) -> u32 {
    let haystack = text.split_whitespace().collect::<Vec<_>>().join(" ").to_ascii_lowercase();
    let needle = phrase.to_ascii_lowercase();
    let bytes = haystack.as_bytes();
    let mut count = 0;
    for (i, _) in haystack.match_indices(&needle) {
        let before = i == 0 || !bytes[i - 1].is_ascii_alphanumeric();
        let end = i + needle.len();
        let after = end == bytes.len() || !bytes[end].is_ascii_alphanumeric();
        if before && after { count += 1; }
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn words() { assert_eq!(count_words("Recession recessionary RECESSION.", "recession"), 2); assert_eq!(count_words("rate\ncut; RATE cut", "rate cut"), 2); }
    #[test] fn source_allowlist() { assert!(valid_source("https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf")); assert!(!valid_source("https://evil.example/FOMCpresconf20260128.pdf")); }
    #[test] fn real_pdf() { let pdf = include_bytes!("../../sdk/fixtures/FOMCpresconf20260128.pdf"); assert_eq!(format!("{:x}", Sha256::digest(pdf)), "2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3"); assert_eq!(count_pdf(pdf, "inflation").unwrap(), 40); assert_eq!(count_pdf(pdf, "recession").unwrap(), 0); }
}
