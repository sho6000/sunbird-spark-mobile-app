import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const resultsDir     = path.join(projectRoot, 'reports', 'junit-results');
const reportDir      = path.join(projectRoot, 'reports', 'md-report');
const screenshotsDir = path.join(projectRoot, 'reports', 'android', 'test-results');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(0).padStart(2, '0');
  return `${m}m ${s}s`;
}

function padEnd(str, len) {
  return String(str).padEnd(len);
}

function padStart(str, len) {
  return String(str).padStart(len);
}

const LINE  = '='.repeat(72);
const DASH  = '-'.repeat(72);

// ---------------------------------------------------------------------------
// XML parsing
// ---------------------------------------------------------------------------

function attr(tag, name) {
  const normalised = tag.replace(/\s+/g, ' ');
  const m = normalised.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? m[1] : '';
}

function attrOrInner(block, tagName) {
  const tagMatch = block.match(new RegExp(`<${tagName}([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  if (!tagMatch) {
    const self = block.match(new RegExp(`<${tagName}([^>]*)\\/?>`, 'i'));
    if (self) return { attrStr: self[1], body: '' };
    return null;
  }
  return { attrStr: tagMatch[1], body: tagMatch[2].trim() };
}

function parseTestCase(tcTag, tcBlock) {
  const name      = attr(tcTag, 'name');
  const className = attr(tcTag, 'classname');
  const time      = parseFloat(attr(tcTag, 'time') || '0');

  let status = 'passed', errorMessage = '', errorBody = '';

  const failure = attrOrInner(tcBlock, 'failure');
  const error   = attrOrInner(tcBlock, 'error');

  if (failure) {
    status       = 'failed';
    errorMessage = attr(failure.attrStr, 'message') || failure.body.split('\n')[0];
    errorBody    = failure.body;
  } else if (error) {
    status       = 'error';
    errorMessage = attr(error.attrStr, 'message') || error.body.split('\n')[0];
    errorBody    = error.body;
  } else if (/<skipped/i.test(tcBlock)) {
    status = 'skipped';
  }

  return { name, class: className, time, status, errorMessage, errorBody };
}

function parseJunitXml(xmlContent) {
  const suites = [];
  const suiteBlockRe = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/gi;
  let suiteMatch;

  while ((suiteMatch = suiteBlockRe.exec(xmlContent)) !== null) {
    const [, attrStr, body] = suiteMatch;

    const suiteName     = attr(attrStr, 'name');
    const totalTests    = parseInt(attr(attrStr, 'tests')    || '0', 10);
    const totalErrors   = parseInt(attr(attrStr, 'errors')   || '0', 10);
    const totalFailures = parseInt(attr(attrStr, 'failures') || '0', 10);
    const skipped       = parseInt(attr(attrStr, 'skipped')  || '0', 10);
    const suiteTime     = parseFloat(attr(attrStr, 'time')   || '0');
    const timestamp     = attr(attrStr, 'timestamp') || '';
    const hostname      = attr(attrStr, 'hostname')  || '';

    const testCases = [];
    const tcRe = /<testcase([^>]*)>([\s\S]*?)<\/testcase>|<testcase([^>]*)\/>/gi;
    let tcMatch;

    while ((tcMatch = tcRe.exec(body)) !== null) {
      const tcTag   = tcMatch[1] ?? tcMatch[3];
      const tcBlock = tcMatch[2] ?? '';
      testCases.push(parseTestCase(tcTag, tcBlock));
    }

    const passed = totalTests - totalFailures - totalErrors - skipped;

    suites.push({
      name:      suiteName.replace(/\.e2e\.ts$/, ''),
      file:      suiteName,
      total:     totalTests,
      passed:    Math.max(0, passed),
      failed:    totalFailures + totalErrors,
      skipped,
      time:      suiteTime,
      timestamp,
      hostname,
      testCases,
    });
  }

  return suites;
}

// ---------------------------------------------------------------------------
// Screenshot lookup
// ---------------------------------------------------------------------------

let _screenshotCache = null;
function getScreenshots() {
  if (_screenshotCache) return _screenshotCache;
  if (!fs.existsSync(screenshotsDir)) return (_screenshotCache = []);
  _screenshotCache = fs.readdirSync(screenshotsDir);
  return _screenshotCache;
}

function findScreenshot(suiteName) {
  const baseName = suiteName.replace(/\.e2e\.ts$/, '');
  const files    = getScreenshots();
  const match    = files.find(f => f.includes(baseName) && /\.(png|jpg|jpeg|webp)$/i.test(f));
  return match ? path.join(screenshotsDir, match) : null;
}

// ---------------------------------------------------------------------------
// Report generation — plain JUnit console style
// ---------------------------------------------------------------------------

function generateReport(suites, meta = {}) {
  const lines = [];

  const now     = new Date();
  const dateStr = now.toISOString().replace('T', ' ').split('.')[0] + ' UTC';

  const totalPassed  = suites.reduce((n, s) => n + s.passed,  0);
  const totalFailed  = suites.reduce((n, s) => n + s.failed,  0);
  const totalSkipped = suites.reduce((n, s) => n + s.skipped, 0);
  const totalAll     = suites.reduce((n, s) => n + s.total,   0);
  const totalTime    = suites.reduce((n, s) => n + s.time,    0);
  const overallResult = totalFailed > 0 ? 'FAILED' : 'PASSED';

  // Header
  lines.push('```');
  lines.push(LINE);
  lines.push('  MOBILE AUTOMATION TEST REPORT');
  lines.push(`  Generated : ${dateStr}`);
  lines.push(`  Result    : ${overallResult}`);
  lines.push(`  Duration  : ${formatDuration(totalTime)}`);
  if (meta.sourceFiles) {
  lines.push(`  Suites    : ${meta.sourceFiles}`);
  }
  lines.push(LINE);
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push(DASH);

  for (const s of suites) {
    const result   = s.failed > 0 ? 'FAIL' : 'PASS';
    const fraction = `${s.passed}/${s.total}`;
    const name     = padEnd(s.name, 42);
    const res      = padEnd(result, 6);
    const frac     = padEnd(fraction, 8);
    const dur      = formatDuration(s.time);
    lines.push(`${name}  ${res}  ${frac}  ${dur}`);
  }

  lines.push('');
  lines.push(`Total: ${totalAll} tests | ${totalPassed} passed | ${totalFailed} failed | ${totalSkipped} skipped | ${formatDuration(totalTime)}`);
  lines.push('');

  // Failed tests
  lines.push(LINE);
  lines.push('FAILED TESTS');
  lines.push(LINE);
  lines.push('');

  let hasFailures = false;
  for (const suite of suites) {
    const failedTests = suite.testCases.filter(tc => tc.status === 'failed' || tc.status === 'error');
    for (const tc of failedTests) {
      hasFailures = true;
      lines.push(`[FAIL] ${suite.name} — ${tc.name}`);
      lines.push(`       Duration : ${formatDuration(tc.time)}`);

      const errLines = (tc.errorMessage || tc.errorBody || 'No error message').split('\n');
      lines.push(`       Error    : ${errLines[0]}`);
      for (let i = 1; i < errLines.length; i++) {
        lines.push(`                  ${errLines[i]}`);
      }

      const screenshot = findScreenshot(suite.file);
      if (screenshot) {
        lines.push(`       Screenshot: ${path.basename(screenshot)}`);
      }

      lines.push('');
    }
  }

  if (!hasFailures) {
    lines.push('  No failures. All tests passed.');
    lines.push('');
  }

  // All tests
  lines.push(LINE);
  lines.push('ALL TESTS');
  lines.push(LINE);
  lines.push('');

  for (const suite of suites) {
    lines.push(suite.name);
    if (suite.timestamp) {
      lines.push(`  Run at : ${suite.timestamp}`);
    }

    for (const tc of suite.testCases) {
      const tag = tc.status === 'passed'  ? '[PASS]'
                : tc.status === 'failed'  ? '[FAIL]'
                : tc.status === 'skipped' ? '[SKIP]'
                : '[ERR ]';
      const name = padEnd(tc.name, 55);
      lines.push(`  ${tag}  ${name}  ${formatDuration(tc.time)}`);
    }

    lines.push('');
  }

  lines.push(LINE);
  lines.push('```');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(resultsDir)) {
    console.error(`ERROR: JUnit results directory not found: ${resultsDir}`);
    process.exit(1);
  }

  const junitFiles = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('junit-') && f.endsWith('.xml'))
    .sort();

  if (junitFiles.length === 0) {
    console.error(`ERROR: No JUnit XML files found in ${resultsDir}`);
    process.exit(1);
  }

  const allSuites = [];
  for (const file of junitFiles) {
    const xml    = fs.readFileSync(path.join(resultsDir, file), 'utf-8');
    const suites = parseJunitXml(xml);
    allSuites.push(...suites);
  }

  if (allSuites.length === 0) {
    console.error('ERROR: No test suites found in JUnit results');
    process.exit(1);
  }

  fs.mkdirSync(reportDir, { recursive: true });

  const md = generateReport(allSuites, { sourceFiles: junitFiles.length });

  const now        = new Date();
  const dateStr    = now.toISOString().split('T')[0];
  const timeStr    = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const reportFile = path.join(reportDir, `Test-Report-${dateStr}-${timeStr}.md`);

  fs.writeFileSync(reportFile, md, 'utf-8');
  console.log(`Report written: ${reportFile}`);

  const totalFailed = allSuites.reduce((n, s) => n + s.failed, 0);
  if (totalFailed > 0) {
    console.error(`\n${totalFailed} test(s) failed`);
    process.exit(1);
  }
}

main();