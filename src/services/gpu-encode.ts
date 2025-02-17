import { exec } from "child_process";
import { readdirSync, statSync, mkdirSync, existsSync } from "fs";
import { join, parse } from "path";

const INPUT_DIR = "input";
const OUTPUT_DIR = "output";

const RESOLUTIONS = ["1920x1080", "1280x720", "854x480"];
const BITRATES = ["5000k", "2800k", "1400k"];
const MAXRATES = ["5350k", "2996k", "1498k"];
const BUFSIZES = ["7500k", "4200k", "2100k"];
const AUDIO_BITRATES = ["192k", "128k", "96k"];
const OUTPUTS = ["1080p", "720p", "480p"];
const HLS_TIME = 10;

// Get all course directories from input directory
const courseDirs = readdirSync(INPUT_DIR).filter((item) => {
  const fullPath = join(INPUT_DIR, item);
  return statSync(fullPath).isDirectory();
});

// Process each course directory
courseDirs.forEach((courseDir) => {
  const coursePath = join(INPUT_DIR, courseDir);
  const courseOutputPath = join(OUTPUT_DIR, courseDir);

  // Create output directory for the course if it doesn't exist
  if (!existsSync(courseOutputPath)) {
    mkdirSync(courseOutputPath, { recursive: true });
  }

  // Get all MP4 files from the course directory
  const mp4Files = readdirSync(coursePath).filter((file) =>
    file.toLowerCase().endsWith(".mp4"),
  );

  mp4Files.forEach((inputFile) => {
    const { name: fileName } = parse(inputFile);

    RESOLUTIONS.forEach((res, index) => {
      const bitrate = BITRATES[index];
      const outputName = OUTPUTS[index];
      // Create stream directories if they don't exist
      OUTPUTS.forEach((output) => {
        const streamDir = join(courseOutputPath, fileName, `stream_${output}`);
        if (!existsSync(streamDir)) {
          mkdirSync(streamDir, { recursive: true });
        }
      });

      const filterComplex = `[0:v]split=3[v1][v2][v3]; \
[v1]scale=w=1920:h=1080[v1out]; \
[v2]scale=w=1280:h=720[v2out]; \
[v3]scale=w=854:h=480[v3out]`;

      const command = `
    ffmpeg -y -hwaccel cuda -hwaccel_output_format cuda -i "${join(coursePath, inputFile)}" \
    -filter_complex "${filterComplex}" \
    -map "[v1out]" -c:v:0 h264_nvenc -preset fast -b:v:0 ${BITRATES[0]} -maxrate:v:0 ${MAXRATES[0]} -bufsize:v:0 ${BUFSIZES[0]} \
    -map "[v2out]" -c:v:1 h264_nvenc -preset fast -b:v:1 ${BITRATES[1]} -maxrate:v:1 ${MAXRATES[1]} -bufsize:v:1 ${BUFSIZES[1]} \
    -map "[v3out]" -c:v:2 h264_nvenc -preset fast -b:v:2 ${BITRATES[2]} -maxrate:v:2 ${MAXRATES[2]} -bufsize:v:2 ${BUFSIZES[2]} \
    -map a:0 -c:a aac -b:a:0 ${AUDIO_BITRATES[0]} -ac 2 \
    -map a:0 -c:a aac -b:a:1 ${AUDIO_BITRATES[1]} -ac 2 \
    -map a:0 -c:a aac -b:a:2 ${AUDIO_BITRATES[2]} -ac 2 \
    -f hls \
    -hls_time ${HLS_TIME} \
    -hls_playlist_type vod \
    -hls_flags independent_segments \
    -hls_segment_type mpegts \
    -hls_segment_filename "${courseOutputPath}/${fileName}/stream_%v/data%03d.ts" \
    -master_pl_name master.m3u8 \
    -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
    "${courseOutputPath}/${fileName}/stream_%v/playlist.m3u8"
  `;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error encoding ${outputName}: ${error}`);
          return;
        }
        console.log(`Encoded ${outputName}: ${stdout}`);
      });
    });
  });
});
