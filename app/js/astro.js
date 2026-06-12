/* =========================================================================
 * astro.js — Astronomical & Chinese-calendar core engine
 *
 * Provides:
 *   - Julian Day conversions
 *   - Apparent solar ecliptic longitude (Meeus, low-precision ~0.01°)
 *   - Lunar longitude, phase, illumination (Meeus low-precision)
 *   - Solar-term mapping & precise solar-term instants
 *   - GanZhi (干支) for year / month / day / hour pillars
 *
 * All civil times are interpreted in a fixed timezone offset (hours east of
 * UTC). Chinese metaphysics is traditionally reckoned in China Standard Time
 * (UTC+8); the caller may pass a different offset.
 * ========================================================================= */

const Astro = (function () {
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;

  function norm360(x) { return ((x % 360) + 360) % 360; }

  /* ---- Julian Day (from civil date/time at given tz offset in hours) ---- */
  function toJD(year, month, day, hour, minute, second, tzOffset) {
    hour = hour || 0; minute = minute || 0; second = second || 0;
    tzOffset = tzOffset == null ? 8 : tzOffset;
    // convert civil → UT
    const dayFrac = (hour + minute / 60 + second / 3600 - tzOffset) / 24;
    let y = year, m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const jd0 = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) +
                day - 1524.5;
    return jd0 + B + dayFrac;
  }

  /* Integer Julian Day Number for a civil date (noon convention). */
  function toJDN(year, month, day) {
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return day + Math.floor((153 * m + 2) / 5) + 365 * y +
           Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }

  /* ΔT (TT - UT) in seconds — polynomial approximation (Espenak/Meeus). */
  function deltaT(year, month) {
    const y = year + (month - 0.5) / 12;
    let t;
    if (y < 1920) { t = (y - 1900) / 100; return -2.79 + 149.4119 * t - 598.939 * t * t + 6196.6 * Math.pow(t, 3) - 19700 * Math.pow(t, 4); }
    if (y < 1986) { t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * Math.pow(t, 3); }
    if (y < 2005) { t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * Math.pow(t, 3) + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5); }
    if (y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    t = (y - 1820) / 100; return -20 + 32 * t * t;
  }

  /* Inverse of toJD: civil {year,month,day,hour,minute} at given tz offset. */
  function jdToCivil(jd, tzOffset) {
    const tz = tzOffset == null ? 8 : tzOffset;
    const z = jd + 0.5 + tz / 24;
    let Z = Math.floor(z);
    let F = z - Z;
    // round to nearest minute (avoids :59:60 artifacts in display)
    let totalMin = Math.round(F * 1440);
    if (totalMin >= 1440) { totalMin -= 1440; Z += 1; }
    let A = Z;
    if (Z >= 2299161) { const al = Math.floor((Z - 1867216.25) / 36524.25); A = Z + 1 + al - Math.floor(al / 4); }
    const B = A + 1524;
    const C = Math.floor((B - 122.1) / 365.25);
    const D = Math.floor(365.25 * C);
    const E = Math.floor((B - D) / 30.6001);
    const day = B - D - Math.floor(30.6001 * E);
    const month = E < 14 ? E - 1 : E - 13;
    const year = month > 2 ? C - 4716 : C - 4715;
    return { year, month, day, hour: Math.floor(totalMin / 60), minute: totalMin % 60 };
  }

  /* Apparent geocentric solar longitude (deg) for a given JD (UT).
   * Internally converts to JDE (TT). */
  function sunLongitude(jd, year, month) {
    const jde = jd + deltaT(year || 2000, month || 1) / 86400;
    const T = (jde - 2451545.0) / 36525.0;
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const Mr = M * D2R;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
              (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
              0.000289 * Math.sin(3 * Mr);
    const trueLong = L0 + C;
    const Omega = 125.04 - 1934.136 * T;
    const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(Omega * D2R);
    return norm360(lambda);
  }

  /* Lunar apparent longitude — Meeus ch. 47 truncated series (~0.003°).
   * Terms: [coeff (1e-6 deg), D, M, Mp, F]; terms in M scale by E (eccentricity). */
  const LUNAR_TERMS = [
    [6288774, 0, 0, 1, 0], [1274027, 2, 0, -1, 0], [658314, 2, 0, 0, 0],
    [213618, 0, 0, 2, 0], [-185116, 0, 1, 0, 0], [-114332, 0, 0, 0, 2],
    [58793, 2, 0, -2, 0], [57066, 2, -1, -1, 0], [53322, 2, 0, 1, 0],
    [45758, 2, -1, 0, 0], [-40923, 0, 1, -1, 0], [-34720, 1, 0, 0, 0],
    [-30383, 0, 1, 1, 0], [15327, 2, 0, 0, -2], [-12528, 0, 0, 1, 2],
    [10980, 0, 0, 1, -2], [10675, 4, 0, -1, 0], [10034, 0, 0, 3, 0],
    [8548, 4, 0, -2, 0], [-7888, 2, 1, -1, 0], [-6766, 2, 1, 0, 0],
    [-5163, 1, 0, -1, 0], [4987, 1, 1, 0, 0], [4036, 2, -1, 1, 0],
    [3994, 2, 0, 2, 0], [3861, 4, 0, 0, 0], [3665, 2, 0, -3, 0],
    [-2689, 0, 1, -2, 0], [-2602, 2, 0, -1, 2], [2390, 2, -1, -2, 0],
    [-2348, 1, 0, 1, 0], [2236, 2, -2, 0, 0], [-2120, 0, 1, 2, 0],
    [-2069, 0, 2, 0, 0], [2048, 2, -2, -1, 0], [-1773, 2, 0, 1, -2],
    [-1595, 2, 0, 0, 2], [1215, 4, -1, -1, 0], [-1110, 0, 0, 2, 2],
  ];
  function moonLongitude(jd, year, month) {
    const jde = jd + deltaT(year || 2000, month || 1) / 86400;
    const T = (jde - 2451545.0) / 36525.0;
    const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841;
    const D  = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T * T * T / 545868;
    const M  = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
    const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699;
    const F  = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T;
    const E  = 1 - 0.002516 * T - 0.0000074 * T * T;
    let sum = 0;
    for (let i = 0; i < LUNAR_TERMS.length; i++) {
      const t = LUNAR_TERMS[i];
      let c = t[0];
      const am = Math.abs(t[2]);
      if (am === 1) c *= E; else if (am === 2) c *= E * E;
      sum += c * Math.sin((t[1] * D + t[2] * M + t[3] * Mp + t[4] * F) * D2R);
    }
    // Venus / Jupiter perturbations + flattening term
    const A1 = 119.75 + 131.849 * T;
    const A2 = 53.09 + 479264.290 * T;
    sum += 3958 * Math.sin(A1 * D2R) + 1962 * Math.sin((Lp - F) * D2R) + 318 * Math.sin(A2 * D2R);
    // nutation in longitude (same Ω as in sunLongitude)
    const Omega = 125.04452 - 1934.136261 * T;
    return norm360(Lp + sum / 1e6 - 0.00478 * Math.sin(Omega * D2R));
  }

  /* Sun-Moon elongation → phase fraction & illumination.
   * Returns {age(days), phaseFrac(0..1), illum(0..1), phaseName, ecLon} */
  function moonInfo(jd, year, month) {
    const sl = sunLongitude(jd, year, month);
    const ml = moonLongitude(jd, year, month);
    let elong = norm360(ml - sl);                 // 0=new, 180=full
    const phaseFrac = elong / 360;                // 0..1 cycle
    const illum = (1 - Math.cos(elong * D2R)) / 2;
    const age = phaseFrac * 29.530588853;
    let idx = Math.floor((elong + 22.5) / 45) % 8;
    return {
      age: age,
      phaseFrac: phaseFrac,
      illum: illum,
      elong: elong,
      phaseName: CM.MOON_PHASES[idx],
      ecLon: ml,
    };
  }

  /* JD (UT) of the new moon at or before the given JD — Newton iteration on
   * the Sun-Moon elongation (mean rate ≈ 12.19°/day). Converges to seconds. */
  function prevNewMoonJD(jd, year, month) {
    const RATE = 12.190749;
    const wrappedElong = j => {
      const e = norm360(moonLongitude(j, year, month) - sunLongitude(j, year, month));
      return ((e + 180) % 360 + 360) % 360 - 180;   // [-180, 180)
    };
    const e0 = norm360(moonLongitude(jd, year, month) - sunLongitude(jd, year, month));
    let t = jd - e0 / RATE;
    for (let i = 0; i < 6; i++) t -= wrappedElong(t) / RATE;
    if (t > jd + 1e-9) t -= 29.530588853;
    return t;
  }

  /* Lunar day number 1..30 (新月=初一): civil days (at the given tz) elapsed
   * since the instant of the most recent new moon. */
  function lunarDay(jd, year, month, tzOffset) {
    const tz = tzOffset == null ? 8 : tzOffset;
    const nm = prevNewMoonJD(jd, year, month);
    const civilDay = j => Math.floor(j + tz / 24 + 0.5);
    let d = civilDay(jd) - civilDay(nm) + 1;
    if (d > 30) d = 30;
    if (d < 1) d = 1;
    return d;
  }

  /* Solar-term number (1..24, 立春=1) currently in effect at given longitude. */
  function solarTermNumber(lambda) {
    return Math.floor((((lambda - 315) % 360 + 360) % 360) / 15) + 1;
  }

  /* Month branch index (0=子) directly from solar longitude.
   * 立春(λ=315) starts 寅 month (branch 2). */
  function monthBranchFromLongitude(lambda) {
    const k = Math.floor((((lambda - 315) % 360 + 360) % 360) / 30);
    return (k + 2) % 12;
  }

  /* Find the JD (UT, given tz) at which the sun reaches target longitude,
   * searching near a guess JD. Newton-ish bisection. */
  function solarTermJD(targetLon, guessJD, year, month, tzOffset) {
    let lo = guessJD - 20, hi = guessJD + 20;
    function f(jd) {
      let diff = sunLongitude(jd, year, month) - targetLon;
      // unwrap to [-180,180]
      diff = ((diff + 180) % 360 + 360) % 360 - 180;
      return diff;
    }
    let flo = f(lo);
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      const fm = f(mid);
      if (Math.abs(hi - lo) < 1e-6) return mid;
      if ((flo < 0 && fm < 0) || (flo > 0 && fm > 0)) { lo = mid; flo = fm; }
      else { hi = mid; }
    }
    return (lo + hi) / 2;
  }

  /* Exact instants of the solar term in effect at jd and of the next term.
   * Returns {termNo, curJD, nextNo, nextJD} (JDs in UT). */
  function termInstants(jd, year, month) {
    const lambda = sunLongitude(jd, year, month);
    const termNo = solarTermNumber(lambda);
    const curLon = norm360(315 + (termNo - 1) * 15);
    const elapsed = norm360(lambda - curLon);              // deg since term began
    const curJD = solarTermJD(curLon, jd - elapsed / 0.9856, year, month);
    const nextJD = solarTermJD(norm360(curLon + 15), curJD + 15.2, year, month);
    return { termNo, curJD, nextNo: termNo % 24 + 1, nextJD };
  }

  /* ----------------------  GanZhi (干支) pillars  ---------------------- */

  /* Jiazi index 0..59 from a stem/branch pair (CRT closed form). */
  function jiaziIndex(stem, branch) {
    return ((6 * stem - 5 * branch) % 60 + 60) % 60;
  }

  /* 旬空 (Void/Empty) branches of the 旬 containing a jiazi: the two branches
   * left uncovered by its ten days. E.g. 甲子旬 → 戌亥. */
  function xunKong(jiazi) {
    const b0 = (jiazi - (jiazi % 10)) % 12;
    return [(b0 + 10) % 12, (b0 + 11) % 12];
  }

  /* Year pillar — uses solar (立春) year boundary. Returns {stem,branch,year} */
  function yearPillar(year, month, day, lambda) {
    let by = year;
    // before 立春 (λ=315): only possible in Jan/early Feb, where λ ∈ [270,315)
    if (month <= 2 && lambda >= 270 && lambda < 315) by = year - 1;
    const idx = ((by - 4) % 60 + 60) % 60;
    return { stem: idx % 10, branch: idx % 12, year: by };
  }

  /* Month pillar — branch from longitude, stem from five-tiger rule. */
  function monthPillar(yearStem, lambda) {
    const branch = monthBranchFromLongitude(lambda);
    const firstStem = (yearStem * 2 + 2) % 10;     // 寅-month stem (五虎遁)
    const offset = ((branch - 2) % 12 + 12) % 12;
    const stem = (firstStem + offset) % 10;
    return { stem: stem, branch: branch };
  }

  /* Day pillar from JDN. Day boundary at 23:00 (late 子时 → next day). */
  function dayPillar(year, month, day, hour) {
    let jdn = toJDN(year, month, day);
    if (hour != null && hour >= 23) jdn += 1;
    const idx = ((jdn + 49) % 60 + 60) % 60;
    return { stem: idx % 10, branch: idx % 12, jiazi: idx, jdn: jdn };
  }

  /* Hour pillar from day stem + clock hour (with minutes). */
  function hourPillar(dayStem, hour, minute) {
    minute = minute || 0;
    const h = hour + minute / 60;
    const branch = Math.floor(((h + 1) % 24) / 2);   // 23-1 → 子(0)
    const ziStem = (dayStem * 2) % 10;               // 五鼠遁
    const stem = (ziStem + branch) % 10;
    return { stem: stem, branch: branch };
  }

  /* Na Yin for a jiazi index (0..59). */
  function naYin(jiazi) { return CM.NAYIN[Math.floor(jiazi / 2)]; }

  /* Full four-pillar chart. dt = {year,month,day,hour,minute, tzOffset, hourKnown} */
  function fourPillars(dt) {
    const tz = dt.tzOffset == null ? 8 : dt.tzOffset;
    const hour = dt.hourKnown ? dt.hour : 12;
    const minute = dt.hourKnown ? (dt.minute || 0) : 0;
    const jd = toJD(dt.year, dt.month, dt.day, hour, minute, 0, tz);
    const lambda = sunLongitude(jd, dt.year, dt.month);

    const yp = yearPillar(dt.year, dt.month, dt.day, lambda);
    const mp = monthPillar(yp.stem, lambda);
    const dp = dayPillar(dt.year, dt.month, dt.day, dt.hourKnown ? hour : null);
    const hp = dt.hourKnown ? hourPillar(dp.stem, hour, minute) : null;

    return {
      jd: jd, lambda: lambda,
      year: yp, month: mp, day: dp, hour: hp,
      solarTermNo: solarTermNumber(lambda),
      yearJiazi: ((yp.year - 4) % 60 + 60) % 60,
      dayJiazi: dp.jiazi,
    };
  }

  return {
    toJD, toJDN, jdToCivil, deltaT, sunLongitude, moonLongitude, moonInfo,
    lunarDay, prevNewMoonJD,
    solarTermNumber, monthBranchFromLongitude, solarTermJD, termInstants,
    yearPillar, monthPillar, dayPillar, hourPillar, naYin, fourPillars,
    jiaziIndex, xunKong, norm360,
  };
})();

if (typeof module !== "undefined") module.exports = Astro;
