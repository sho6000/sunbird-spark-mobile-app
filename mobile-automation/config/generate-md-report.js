import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const resultsDir = path.join(projectRoot, 'reports', 'junit-results');
const reportDir = path.join(projectRoot, 'reports', 'md-report');
const screenshotsDir = path.join(projectRoot, 'reports', 'android', 'test-results');

const junitFile = path.join(resultsDir, 'junit-results.xml');

function escapeMd(text) {
    return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function parseJunitXml(xmlContent) {
    const suites = [];

    const testsuiteRegex = /<testsuite[^>]*>/gs;
    let suiteMatch;

    while ((suiteMatch = testsuiteRegex.exec(xmlContent)) !== null) {
        const tag = suiteMatch[0];
        const suiteName = tag.match(/\bname="([^"]*)"/)?.[1] || '';
        const totalTests = parseInt(tag.match(/\btests="(\d+)"/)?.[1] || '0', 10);
        const totalErrors = parseInt(tag.match(/\berrors="(\d+)"/)?.[1] || '0', 10);
        const totalFailures = parseInt(tag.match(/\bfailures="(\d+)"/)?.[1] || '0', 10);
        const time = parseFloat(tag.match(/\btime="([^"]*)"/)?.[1] || '0');

        const testCases = [];

        const suiteBlockEnd = xmlContent.indexOf('</testsuite>', suiteMatch.index);
        const suiteBlock = xmlContent.slice(suiteMatch.index, suiteBlockEnd + 12);

        const testcaseRegex = /<testcase[^>]*>/gs;
        let tcMatch;

        const failureRegex = /<failure[^>]*message="([^"]*)"[^>]*>([\s\S]*?)<\/failure>/g;
        const failures = [];
        let fMatch;
        while ((fMatch = failureRegex.exec(suiteBlock)) !== null) {
            failures.push({ message: fMatch[1], body: fMatch[2].trim() });
        }

        let failureIndex = 0;
        while ((tcMatch = testcaseRegex.exec(suiteBlock)) !== null) {
            const tcTag = tcMatch[0];
            const tcName = tcTag.match(/\bname="([^"]*)"/)?.[1] || '';
            const tcClass = tcTag.match(/\bclassname="([^"]*)"/)?.[1] || '';
            const tcTime = parseFloat(tcTag.match(/\btime="([^"]*)"/)?.[1] || '0');

            const tcEndIndex = suiteBlock.indexOf('</testcase>', tcMatch.index);
            const tcBlock = suiteBlock.slice(tcMatch.index, tcEndIndex + 11);

            let status = 'passed';
            let errorMessage = '';
            let errorBody = '';

            if (tcBlock.includes('<failure')) {
                status = 'failed';
                if (failures[failureIndex]) {
                    errorMessage = failures[failureIndex].message;
                    errorBody = failures[failureIndex].body;
                }
                failureIndex++;
            } else if (tcBlock.includes('<error')) {
                status = 'error';
                const errMatch = tcBlock.match(/<error[^>]*message="([^"]*)"[^>]*>/);
                if (errMatch) errorMessage = errMatch[1];
                failureIndex++;
            } else if (tcBlock.includes('<skipped')) {
                status = 'skipped';
            }

            testCases.push({
                name: tcName,
                class: tcClass,
                time: tcTime,
                status,
                errorMessage,
                errorBody,
            });
        }

        const passed = totalTests - totalFailures - totalErrors;

        suites.push({
            name: suiteName.replace(/\.e2e\.ts$/, ''),
            file: suiteName,
            total: totalTests,
            passed,
            failed: totalFailures + totalErrors,
            time,
            testCases,
        });
    }

    return suites;
}

function findScreenshot(suiteName) {
    const baseName = suiteName.replace(/\.e2e\.ts$/, '');
    if (!fs.existsSync(screenshotsDir)) return null;
    const files = fs.readdirSync(screenshotsDir);
    const match = files.find(f => f.includes(baseName) && (f.endsWith('.png') || f.endsWith('.jpg')));
    return match ? path.join(screenshotsDir, match) : null;
}

function generateMarkdown(suites) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString();

    let md = `# Mobile Automation Test Report\n\n`;
    md += `**Date:** ${dateStr} ${timeStr}\n\n`;

    md += `---\n\n## Summary\n\n`;
    md += `| Suite | Status | Passed | Failed | Total | Time |\n`;
    md += `|-------|--------|--------|--------|-------|------|\n`;

    let totalPassed = 0;
    let totalFailed = 0;
    let totalAll = 0;

    for (const suite of suites) {
        const statusIcon = suite.failed > 0 ? '❌' : '✅';
        md += `| ${suite.file} | ${statusIcon} | ${suite.passed} | ${suite.failed} | ${suite.total} | ${suite.time.toFixed(1)}s |\n`;
        totalPassed += suite.passed;
        totalFailed += suite.failed;
        totalAll += suite.total;
    }

    const overallIcon = totalFailed > 0 ? '❌' : '✅';
    md += `| **Total** | ${overallIcon} | **${totalPassed}** | **${totalFailed}** | **${totalAll}** | |\n\n`;

    md += `---\n\n## Failed Tests\n\n`;

    let failedCount = 0;
    for (const suite of suites) {
        const failedTests = suite.testCases.filter(tc => tc.status === 'failed' || tc.status === 'error');
        if (failedTests.length === 0) continue;

        for (const tc of failedTests) {
            failedCount++;
            md += `### ${failedCount}. ${suite.file} — ${tc.name}\n\n`;
            md += `**Status:** \`${tc.status}\`\n\n`;
            md += `**Error:**\n\`\`\`\n${escapeMd(tc.errorMessage || tc.errorBody || 'No error message')}\n\`\`\`\n\n`;
            if (tc.errorBody && tc.errorBody !== tc.errorMessage) {
                md += `**Details:**\n\`\`\`\n${escapeMd(tc.errorBody)}\n\`\`\`\n\n`;
            }

            const screenshot = findScreenshot(suite.file);
            if (screenshot) {
                const relPath = path.relative(projectRoot, screenshot);
                md += `**Screenshot:** \`${relPath}\`\n\n`;
            }
        }
    }

    if (failedCount === 0) {
        md += `All tests passed! 🎉\n\n`;
    }

    md += `---\n\n## All Tests\n\n`;

    for (const suite of suites) {
        md += `### ${suite.file}\n\n`;
        md += `| Test | Status | Time |\n`;
        md += `|------|--------|------|\n`;
        for (const tc of suite.testCases) {
            const icon = tc.status === 'passed' ? '✅' : tc.status === 'failed' ? '❌' : tc.status === 'error' ? '⚠️' : '⏭️';
            md += `| ${escapeMd(tc.name)} | ${icon} ${tc.status} | ${tc.time.toFixed(1)}s |\n`;
        }
        md += '\n';
    }

    md += `---\n*Report generated by mobile-automation/config/generate-md-report.js*\n`;

    return md;
}

function main() {
    if (!fs.existsSync(junitFile)) {
        console.error(`JUnit results file not found: ${junitFile}`);
        console.error('Run tests first: cd config && npm run wdio');
        process.exit(1);
    }

    const xmlContent = fs.readFileSync(junitFile, 'utf-8');
    const suites = parseJunitXml(xmlContent);

    if (suites.length === 0) {
        console.error('No test suites found in JUnit results');
        process.exit(1);
    }

    fs.mkdirSync(reportDir, { recursive: true });

    const md = generateMarkdown(suites);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const reportFile = path.join(reportDir, `Test-Report-${dateStr}.md`);

    fs.writeFileSync(reportFile, md, 'utf-8');
    console.log(`✅ Report generated: ${reportFile}`);
}

main();
