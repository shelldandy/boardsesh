mod frames_parser;
mod renderer;
mod types;

use wasm_bindgen::prelude::*;

use crate::renderer::render_overlay as render_overlay_impl;
use crate::types::RenderConfig;

/// Render a transparent overlay image with hold circles.
///
/// Takes a JSON config string with board dimensions, frames string, holds data,
/// and hold state color mapping. Returns a PNG-encoded byte array with alpha transparency.
///
/// The overlay is mostly transparent with ~5-15 colored circles, so PNG compresses
/// extremely well (typically 2-5KB). Board background images are served separately
/// as static WebP assets.
#[wasm_bindgen]
pub fn render_overlay(config_json: &str) -> Result<Vec<u8>, JsValue> {
    let config: RenderConfig = serde_json::from_str(config_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse config: {e}")))?;

    let (rgba_data, width, height) = render_overlay_impl(&config)
        .map_err(|e| JsValue::from_str(&format!("Render failed: {e}")))?;

    // Encode as PNG with alpha transparency
    let png_data = encode_png(&rgba_data, width, height)
        .map_err(|e| JsValue::from_str(&format!("PNG encoding failed: {e}")))?;

    Ok(png_data)
}

fn encode_png(rgba_data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut buf, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.set_compression(png::Compression::Fast);

        let mut writer = encoder
            .write_header()
            .map_err(|e| format!("PNG header error: {e}"))?;
        writer
            .write_image_data(rgba_data)
            .map_err(|e| format!("PNG write error: {e}"))?;
    }
    Ok(buf)
}
