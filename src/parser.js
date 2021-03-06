const fs = require('fs');
const readline = require('readline');
const { FromString } = require('dotosb');

const flags = {
  circle: 1 << 0,        // 1
  slider: 1 << 1,        // 2
  newCombo: 1 << 2,      // 4
  spinner: 1 << 3,       // 8
  skipColor1: 1 << 4,    // 16
  skipColor2: 1 << 5,    // 32
  skipColor3: 1 << 6,    // 64
  hold: 1 << 7,          // 128
  color: 16 | 32 | 64
}

function loadBeatmap(file_path) {

  const file = fs.readFileSync(file_path, 'utf-8');
  const lines = file.split(/\r?\n/);


  let beatmap = {};
  let group = undefined;
  let line_number = 0;
  let event_capture = "";
  let comboIndex = 0;
  let colorIncrement = 0;
  let colorIndex = 0;
  let previousObject = undefined;

  beatmap.colours = [
    { r: 255, g: 192, b: 0 },
    { r: 0, g: 202, b: 0 },
    { r: 18, g: 124, b: 255 },
    { r: 242, g: 24, b: 57 },
  ];

  for(const line of lines) {
    line_number++;
    if (line === "" || line == null) continue;

    if (line_number == 1) {
      beatmap.format_number = line.match(/v[0-9]+/)[0];
      continue;
    }

    let line_group_info = getGroup(line, group);
    if (line_group_info.changed) {
      group = line_group_info.group.toLowerCase();
      beatmap[group] =
        group === "timingpoints" ||
          group === "colours" ||
          group === "hitobjects"
          ? [] : {};
          continue;
    }


    switch (group) {
      case "general":
      case "difficulty":
        const general_values = line.split(':');
        const general_key = general_values[0].trim().toLowerCase();
        const general_value = normalizeValue(general_values[1]);
        beatmap[group][general_key] = general_value;
        break;

      case "editor":
        const editor_values = line.split(':');
        const editor_key = editor_values[0].trim().toLowerCase();
        const editor_value = normalizeValue(editor_values[1]);

        if (editor_key === "bookmarks") {
          beatmap.editor.bookmarks = getBookmarks(editor_values[1]);
          continue;
        }

        beatmap[group][editor_key] = editor_value;
        break;

      case "metadata":
        const metadata_values = line.split(':');
        const metadata_key = metadata_values[0].trim().toLowerCase();
        const metadata_value = normalizeValue(metadata_values[1]);

        if (metadata_key === "tags") {
          beatmap.metadata.tags = getTags(metadata_value);
          continue;
        }
        beatmap[group][metadata_key] = metadata_value;
        break;

      case "events":
        event_capture += `${line}\n`;
        break;

      case "timingpoints":
        const timing_values = line.split(',');
        const timing_point = {
          type: timing_values[6] === '1' ? 'red' : 'green',
          time: parseInt(timing_values[0]),
          sampleSet: parseInt(timing_values[3]),
          sampleIndex: parseInt(timing_values[4]),
          volume: parseInt(timing_values[5]),
        };

        if (timing_point.type === 'red') {
          timing_point.meter = parseInt(timing_values[2]);
          timing_point.beatLength = parseFloat(timing_values[1]);
          timing_point.bpm = parseFloat((1 / timing_point.beatLength * 1000 * 60).toFixed(2));
        }

        if (timing_point.type === 'green') {
          const bdsv = parseFloat(timing_values[1]);
          timing_point.bdsv = bdsv;
          timing_point.multiplier = Math.round((1 / (bdsv > 0 ? 1.0 : -(bdsv / 100.0))) * 10) / 10;
        }

        timing_point.kiai = parseInt(timing_values[7]) & 1 == 1 ? true : false;

        if (!beatmap.timingpoints[timing_point.type]) {
          beatmap.timingpoints[timing_point.type] = [];
        }

        beatmap.timingpoints[timing_point.type].push(timing_point);
        break;

      case "colours":

        const colours_values = line.split(':');
        const colours_value = colours_values[1].trim().split(',');
        const colour = {
          r: parseInt(colours_value[0]),
          g: parseInt(colours_value[1]),
          b: parseInt(colours_value[2]),
        };

        beatmap[group].push(colour);
        break;

      case "hitobjects":

        const object_values = line.split(',');
        const object_type = parseInt(object_values[3]);

        if ((object_type & flags.newCombo) != 0 || previousObject == undefined || hasFlag(previousObject, flags.spinner)) {
          colorIncrement = (object_type >> 4) & 7;
          if ((object_type & flags.spinner) == 0)
            colorIncrement++;
          colorIndex = (colorIndex + colorIncrement) % beatmap.colours.length;
          comboIndex = 0;
        }
        comboIndex++;

        const hitobject = {
          position: {
            x: parseInt(object_values[0]),
            y: parseInt(object_values[1]),
          },
          time: parseInt(object_values[2]),
          type: parseInt(object_values[3]),
          hitsound: parseInt(object_values[4]),
          color: beatmap.colours[colorIndex]
        }

        previousObject = hitobject;
        beatmap[group].push(hitobject);
        break;


      default:
        break;
    }
  };
  return beatmap;
}

function hasFlag(object, value) {
  if ((object.type & value) != 0) {
    return true;
  } else return false;
}

function getBookmarks(line_data) {
  return line_data.split(',').map(bookmark => {
    return normalizeValue(bookmark);
  });
}

function getTags(line_data) {
  return line_data.split(' ').map(tag => {
    return tag.trim();
  });
}

function normalizeValue(value) {
  return Number.isInteger(value) ? parseInt(value): value.trim();
}

function getGroup(line, current) {
  const line_trimmed = line.trim();
  if (line_trimmed[0] == '[') {
    return {
      changed: true,
      group: line_trimmed.match(/(?!=\[)[a-zA-Z]+/)[0]
    }
  }

  return {
    changed: false,
    group: current
  }
}

exports.loadBeatmap = loadBeatmap;