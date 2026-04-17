import fetch from "node-fetch";
import fs from "fs";
import path from "path";

/**
 * Download audio from Meta Cloud API
 * Meta sends media_id in the message
 * We need to fetch the actual file using the media_id and access token
 */
export async function downloadAudioFromMeta(mediaId, accessToken) {
  try {
    console.log(`📥 Downloading audio: ${mediaId}`);

    // Step 1: Get the URL of the audio file
    const urlResponse = await fetch(
      `https://graph.instagram.com/v19.0/${mediaId}?fields=media_product_type,file_size`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const urlData = await urlResponse.json();

    if (urlData.error) {
      throw new Error(`Meta API error: ${urlData.error.message}`);
    }

    // Step 2: Download the actual audio file
    const fileResponse = await fetch(
      `https://graph.instagram.com/v19.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!fileResponse.ok) {
      throw new Error(`Failed to download: ${fileResponse.statusText}`);
    }

    // Convert to buffer
    const buffer = await fileResponse.buffer();
    console.log(`✅ Audio downloaded: ${buffer.length} bytes`);

    return buffer;

  } catch (err) {
    console.error("❌ Error downloading audio:", err.message);
    throw err;
  }
}

/**
 * Optimize audio for processing
 * - Downsample to 16kHz
 * - Convert to mono
 * - Remove silence
 * - Compress if needed
 *
 * Note: This requires ffmpeg or audio processing library
 * For MVP, we'll keep it simple and just validate
 */
export async function optimizeAudio(audioBuffer) {
  try {
    console.log("🔧 Optimizing audio...");

    // TODO: Implement actual audio optimization using ffmpeg or nodejs-audio-library
    // For now, just return the buffer as-is
    // In production, you'd:
    // 1. Detect audio format (MP4, OGG, etc.)
    // 2. Downsample to 16kHz mono if needed
    // 3. Remove silence at start/end
    // 4. Compress if > size limit

    // Placeholder optimization
    if (audioBuffer.length > 5 * 1024 * 1024) {
      // If > 5MB, would need to compress
      console.warn("⚠️ Audio > 5MB - consider compression");
    }

    console.log("✅ Audio optimized");
    return audioBuffer;

  } catch (err) {
    console.error("❌ Error optimizing audio:", err);
    throw err;
  }
}

/**
 * Save audio temporarily for processing
 * Returns temp file path
 */
export async function saveTempAudio(audioBuffer, extension = "ogg") {
  try {
    const tempDir = "./temp";

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(
      tempDir,
      `audio_${Date.now()}.${extension}`
    );

    fs.writeFileSync(tempFile, audioBuffer);
    console.log(`💾 Temp audio saved: ${tempFile}`);

    return tempFile;

  } catch (err) {
    console.error("❌ Error saving temp audio:", err);
    throw err;
  }
}

/**
 * Clean up temporary audio files
 */
export async function cleanupTempAudio(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Cleaned up: ${filePath}`);
    }
  } catch (err) {
    console.error("❌ Error cleaning up:", err);
  }
}

/**
 * Complete audio processing pipeline
 */
export async function processAudio(mediaId, accessToken) {
  let tempFile = null;

  try {
    // Step 1: Download from Meta
    const audioBuffer = await downloadAudioFromMeta(mediaId, accessToken);

    // Step 2: Optimize
    const optimized = await optimizeAudio(audioBuffer);

    // Step 3: Save temporarily (if needed for file-based processing)
    tempFile = await saveTempAudio(optimized);

    console.log("✅ Audio processing complete");

    return {
      buffer: optimized,
      tempFile: tempFile,
      size: optimized.length,
    };

  } catch (err) {
    // Clean up on error
    if (tempFile) {
      await cleanupTempAudio(tempFile);
    }

    console.error("🔥 Audio processing pipeline failed:", err);
    throw err;
  }
}

/**
 * Estimate audio duration from buffer
 * More accurate than simple size calculation
 */
export function estimateDuration(audioBuffer, sampleRate = 16000) {
  // This is very approximate
  // For actual duration, parse the audio format metadata
  // Rough estimate: 16kHz 16-bit mono = 32KB per second
  const bytesPerSecond = sampleRate * 2; // 16-bit = 2 bytes per sample
  const durationSeconds = audioBuffer.length / bytesPerSecond;
  return Math.round(durationSeconds);
}
  
