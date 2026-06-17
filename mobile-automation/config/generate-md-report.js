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

function escapeMd(text = '') {
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(0).padStart(2, '0');
  return `${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// XML attribute / content extraction
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

// ---------------------------------------------------------------------------
// Parse a single <testcase> block
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Parse all <testsuite> blocks
// ---------------------------------------------------------------------------

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
// Markdown generation — clean standard README style
// ---------------------------------------------------------------------------

function statusBadge(failed, total) {
  return failed > 0
    ? `![FAILED](https://img.shields.io/badge/tests-FAILED-red)`
    : `![PASSED](https://img.shields.io/badge/tests-PASSED-brightgreen)`;
}

function generateSummaryTable(suites) {
  const lines = [
    '| Suite | Result | Passed | Failed | Skipped | Duration |',
    '|-------|--------|-------:|-------:|--------:|---------:|',
  ];

  let totalPassed = 0, totalFailed = 0, totalSkipped = 0, totalTime = 0;

  for (const s of suites) {
    const result = s.failed > 0 ? '❌ FAIL' : '✅ PASS';
    lines.push(
      `| ${escapeMd(s.name)} | ${result} | ${s.passed} | ${s.failed} | ${s.skipped} | ${formatDuration(s.time)} |`
    );
    totalPassed  += s.passed;
    totalFailed  += s.failed;
    totalSkipped += s.skipped;
    totalTime    += s.time;
  }

  lines.push('|---|---|---|---|---|---|');
  const overallResult = totalFailed > 0 ? '❌ FAIL' : '✅ PASS';
  lines.push(
    `| **Total** | **${overallResult}** | **${totalPassed}** | **${totalFailed}** | **${totalSkipped}** | **${formatDuration(totalTime)}** |`
  );

  return lines.join('\n');
}

function generateFailedSection(suites) {
  const lines = [];
  let failedCount = 0;

  for (const suite of suites) {
    const failedTests = suite.testCases.filter(tc => tc.status === 'failed' || tc.status === 'error');
    if (failedTests.length === 0) continue;

    for (const tc of failedTests) {
      failedCount++;
      lines.push(`#### ${failedCount}. ${tc.name}`);
      lines.push('');
      lines.push(`| Field | Value |`);
      lines.push(`|-------|-------|`);
      lines.push(`| Suite | ${suite.name} |`);
      lines.push(`| Status | \`${tc.status}\` |`);
      lines.push(`| Duration | ${formatDuration(tc.time)} |`);
      lines.push('');
      lines.push('**Error message**');
      lines.push('```');
      lines.push(tc.errorMessage || tc.errorBody || 'No error message');
      lines.push('```');

      if (tc.errorBody && tc.errorBody !== tc.errorMessage && tc.errorBody.length > 0) {
        lines.push('');
        lines.push('<details>');
        lines.push('<summary>Stack trace</summary>');
        lines.push('');
        lines.push('```');
        lines.push(tc.errorBody);
        lines.push('```');
        lines.push('</details>');
      }

      const screenshot = findScreenshot(suite.file);
      if (screenshot) {
        const relPath = path.relative(projectRoot, screenshot);
        lines.push('');
        lines.push(`**Screenshot:** [\`${path.basename(relPath)}\`](./${relPath})`);
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  if (failedCount === 0) {
    lines.push('> No failures recorded.');
    lines.push('');
  }

  return lines.join('\n');
}

function generateAllTestsSection(suites) {
  const lines = [];

  for (const suite of suites) {
    lines.push(`### ${suite.name}`);
    lines.push('');
    if (suite.timestamp) {
      lines.push(`> **Run at:** ${suite.timestamp}${suite.hostname ? ` on \`${suite.hostname}\`` : ''}`);
      lines.push('');
    }
    lines.push('| # | Test | Result | Duration |');
    lines.push('|---|------|--------|--------:|');

    suite.testCases.forEach((tc, i) => {
      const result = tc.status === 'passed' ? '✅ pass'
                   : tc.status === 'failed' ? '❌ fail'
                   : tc.status === 'skipped' ? '⏭️ skip'
                   : '⚠️ error';
      lines.push(`| ${i + 1} | ${escapeMd(tc.name)} | ${result} | ${formatDuration(tc.time)} |`);
    });

    lines.push('');
  }

  return lines.join('\n');
}

function generateMarkdown(suites, meta = {}) {
  const now     = new Date();
  const dateStr = now.toISOString().replace('T', ' ').split('.')[0] + ' UTC';

  const totalPassed  = suites.reduce((n, s) => n + s.passed,  0);
  const totalFailed  = suites.reduce((n, s) => n + s.failed,  0);
  const totalSkipped = suites.reduce((n, s) => n + s.skipped, 0);
  const totalAll     = suites.reduce((n, s) => n + s.total,   0);
  const totalTime    = suites.reduce((n, s) => n + s.time,    0);

  const overallResult = totalFailed > 0 ? 'FAILED' : 'PASSED';
  const badge = totalFailed > 0
    ? `![FAILED](https://img.shields.io/badge/Result-FAILED-red)`
    : `![PASSED](https://img.shields.io/badge/Result-PASSED-brightgreen)`;

  const parts = [
    `# Test Report`,
    '',
    badge,
    '',
    '## Run details',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Generated | ${dateStr} |`,
    `| Result | **${overallResult}** |`,
    `| Total tests | ${totalAll} |`,
    `| Passed | ${totalPassed} |`,
    `| Failed | ${totalFailed} |`,
    `| Skipped | ${totalSkipped} |`,
    `| Duration | ${formatDuration(totalTime)} |`,
    meta.sourceFiles ? `| Suites run | ${meta.sourceFiles} |` : null,
    '',
    '---',
    '',
    '## Summary',
    '',
    generateSummaryTable(suites),
    '',
    '---',
    '',
    `## Failed tests`,
    '',
    generateFailedSection(suites),
    '## All tests',
    '',
    generateAllTestsSection(suites),
    '---',
    '',
    `*Generated by [generate-md-report.js](./generate-md-report.js)*`,
  ].filter(line => line !== null);

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(resultsDir)) {
    console.error(`❌ JUnit results directory not found: ${resultsDir}`);
    process.exit(1);
  }

  const junitFiles = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('junit-') && f.endsWith('.xml'))
    .sort();

  if (junitFiles.length === 0) {
    console.error(`❌ No JUnit XML files found in ${resultsDir}`);
    process.exit(1);
  }

  const allSuites = [];
  for (const file of junitFiles) {
    const xml    = fs.readFileSync(path.join(resultsDir, file), 'utf-8');
    const suites = parseJunitXml(xml);
    allSuites.push(...suites);
  }

  if (allSuites.length === 0) {
    console.error('❌ No test suites found in JUnit results');
    process.exit(1);
  }

  fs.mkdirSync(reportDir, { recursive: true });

  const md = generateMarkdown(allSuites, { sourceFiles: junitFiles.length });

  const now        = new Date();
  const dateStr    = now.toISOString().split('T')[0];
  const timeStr    = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const reportFile = path.join(reportDir, `Test-Report-${dateStr}-${timeStr}.md`);

  fs.writeFileSync(reportFile, md, 'utf-8');
  console.log(`✅ Report written: ${reportFile}`);

  const totalFailed = allSuites.reduce((n, s) => n + s.failed, 0);
  if (totalFailed > 0) {
    console.error(`\n⚠️  ${totalFailed} test(s) failed — exiting with code 1`);
    process.exit(1);
  }
}

main();