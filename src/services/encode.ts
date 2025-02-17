import { exec } from "child_process";
import { readdirSync, statSync, mkdirSync, existsSync } from "fs";
import { join, parse } from "path";

const INPUT_DIR = "input";
const OUTPUT_DIR = "output";

const RESOLUTIONS = ["1280x720", "1920x1080", "3840x2160"];
const BITRATES = ["1200k", "2500k", "8000k"];
const OUTPUTS = ["720p", "1080p", "2160p"];
const GOP_SIZE = 4;

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
      const profile =
        outputName === "2160p"
          ? "high"
          : outputName === "1080p"
            ? "high"
            : "main";
      const level =
        outputName === "2160p" ? "5.1" : outputName === "1080p" ? "4.2" : "3.1";

      const command = `
    ffmpeg -y -i "${join(coursePath, inputFile)}" \
    -c:v libx264 -preset veryfast -profile:v ${profile} -level:v ${level} -b:v ${bitrate} -s ${res} \
    -c:a aac -b:a 128k -ac 2 \
    -g ${GOP_SIZE} -keyint_min ${GOP_SIZE} -sc_threshold 0 \
    -force_key_frames "expr:gte(t,n_forced*4)" \
    -hls_time 4 -hls_list_size 0 -hls_flags independent_segments \
    -hls_segment_filename "${courseOutputPath}/${fileName}_${outputName}_%03d.ts" \
    "${courseOutputPath}/${fileName}_${outputName}.m3u8"
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
