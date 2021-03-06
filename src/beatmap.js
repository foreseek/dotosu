function getTimingAt(beatmap, time) {
  let last_point = beatmap.timingpoints.red[0];
  for (let i = 0; i < beatmap.timingpoints.red.length; i++) {
    const timing_point = beatmap.timingpoints.red[i];

    if (time < timing_point.time) {
      return last_point;
    }

    last_point = timing_point;
  }
}

module.exports = { getTimingAt };