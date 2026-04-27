import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import xml from 'highlight.js/lib/languages/xml';
import plaintext from 'highlight.js/lib/languages/plaintext';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('plaintext', plaintext);

export interface Issue {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  line: number;
  column: number;
  code: string;
  suggestion: string;
  fixedCode: string;
  confidence: number;
  impact: string;
  effort: string;
  references?: string[];
}

export interface AnalysisResult {
  language: string;
  score: number;
  issues: Issue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    securityIssues: number;
    performanceIssues: number;
    qualityIssues: number;
  };
  metrics: {
    complexity: number;
    maintainability: number;
    readability: number;
    performance: number;
    security: number;
    documentation: number;
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    linesOfCode: number;
    duplicateLines: number;
    testCoverage: number;
  };
  recommendations: string[];
  codeSmells: number;
  technicalDebt: string;
  timestamp: string;
}

export class AdvancedCodeAnalyzer {
  private static instance: AdvancedCodeAnalyzer;
  private issueIdCounter = 0;

  static getInstance(): AdvancedCodeAnalyzer {
    if (!AdvancedCodeAnalyzer.instance) {
      AdvancedCodeAnalyzer.instance = new AdvancedCodeAnalyzer();
    }
    return AdvancedCodeAnalyzer.instance;
  }

  async analyzeCode(codeContent: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const detection = hljs.highlightAuto(codeContent);
    const language = detection.language || 'unknown';
    const lines = codeContent.split('\n');
    const linesOfCode = lines.length;
    
    console.log(`Starting analysis of ${linesOfCode} lines in ${language}`);
    
    // Initialize metrics
    let issues: Issue[] = [];
    let complexity = 1;
    let securityScore = 100;
    let performanceScore = 100;
    let maintainabilityScore = 100;
    let readabilityScore = 100;
    let documentationScore = 0;
    
    // Language-specific analysis
    issues = issues.concat(await this.analyzeLanguageSpecific(codeContent, language));
    
    // Security analysis
    issues = issues.concat(await this.analyzeSecurityPatterns(codeContent));
    
    // Performance analysis
    issues = issues.concat(await this.analyzePerformancePatterns(codeContent));
    
    // Code quality analysis
    issues = issues.concat(await this.analyzeCodeQuality(codeContent));
    
    // Documentation analysis
    documentationScore = this.analyzeDocumentation(codeContent);
    
    // Complexity analysis
    complexity = this.analyzeComplexity(codeContent);
    
    // Calculate scores based on issues
    securityScore = Math.max(0, 100 - (issues.filter(i => i.category === 'Security').length * 15));
    performanceScore = Math.max(0, 100 - (issues.filter(i => i.category === 'Performance').length * 10));
    maintainabilityScore = Math.max(20, 100 - (issues.filter(i => i.category === 'Maintainability').length * 8));
    readabilityScore = Math.max(30, 100 - (issues.filter(i => i.category === 'Readability').length * 5));
    
    const overallScore = Math.round(
      (securityScore + performanceScore + maintainabilityScore + readabilityScore + documentationScore) / 5
    );
    
    const summary = {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      mediumIssues: issues.filter(i => i.severity === 'medium').length,
      lowIssues: issues.filter(i => i.severity === 'low').length,
      securityIssues: issues.filter(i => i.category === 'Security').length,
      performanceIssues: issues.filter(i => i.category === 'Performance').length,
      qualityIssues: issues.filter(i => i.category === 'Code Quality').length
    };
    
    const recommendations = this.generateRecommendations(issues, codeContent, language);
    const codeSmells = this.calculateCodeSmells(issues, complexity);
    const technicalDebt = this.calculateTechnicalDebt(issues);
    
    const analysisTime = Date.now() - startTime;
    console.log(`Analysis completed in ${analysisTime}ms`);
    
    return {
      language,
      score: overallScore,
      issues,
      summary,
      metrics: {
        complexity: Math.min(100, complexity * 5),
        maintainability: maintainabilityScore,
        readability: readabilityScore,
        performance: performanceScore,
        security: securityScore,
        documentation: documentationScore,
        cyclomaticComplexity: complexity,
        cognitiveComplexity: Math.floor(complexity * 0.8),
        linesOfCode,
        duplicateLines: this.findDuplicateLines(codeContent),
        testCoverage: this.estimateTestCoverage(codeContent)
      },
      recommendations,
      codeSmells,
      technicalDebt,
      timestamp: new Date().toISOString()
    };
  }

  private async analyzeLanguageSpecific(code: string, language: string): Promise<Issue[]> {
    const issues: Issue[] = [];
    
    switch (language) {
      case 'javascript':
      case 'typescript':
        return this.analyzeJavaScript(code);
      case 'python':
        return this.analyzePython(code);
      case 'java':
        return this.analyzeJava(code);
      default:
        return this.analyzeGeneric(code);
    }
  }

  private analyzeJavaScript(code: string): Issue[] {
    const issues: Issue[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      // Check for var usage
      if (/\bvar\s+/.test(trimmed)) {
        issues.push({
          id: `js-var-${this.issueIdCounter++}`,
          type: 'deprecated',
          severity: 'medium',
          category: 'Best Practices',
          message: 'Use let or const instead of var',
          line: idx + 1,
          column: trimmed.indexOf('var') + 1,
          code: trimmed,
          suggestion: 'Replace var with let for variables that change, or const for constants',
          fixedCode: trimmed.replace(/\bvar\b/, 'const'),
          confidence: 95,
          impact: 'medium',
          effort: 'easy',
          references: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let']
        });
      }
      
      // Check for == usage
      if (/==(?!=)/.test(trimmed) && !/===/.test(trimmed)) {
        issues.push({
          id: `js-equality-${this.issueIdCounter++}`,
          type: 'comparison',
          severity: 'medium',
          category: 'Best Practices',
          message: 'Use strict equality (===) instead of loose equality (==)',
          line: idx + 1,
          column: trimmed.indexOf('==') + 1,
          code: trimmed,
          suggestion: 'Use === for strict equality comparison',
          fixedCode: trimmed.replace(/==/g, '==='),
          confidence: 90,
          impact: 'medium',
          effort: 'easy'
        });
      }
      
      // Check for console.log in production
      if (/console\.(log|warn|error|debug|info)/.test(trimmed)) {
        issues.push({
          id: `js-console-${this.issueIdCounter++}`,
          type: 'debugging',
          severity: 'low',
          category: 'Code Quality',
          message: 'Remove console statements from production code',
          line: idx + 1,
          column: trimmed.indexOf('console') + 1,
          code: trimmed,
          suggestion: 'Use proper logging framework or remove debugging statements',
          fixedCode: `// ${trimmed}`,
          confidence: 85,
          impact: 'low',
          effort: 'easy'
        });
      }
    });
    
    return issues;
  }

  private analyzePython(code: string): Issue[] {
    const issues: Issue[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      // Check for missing colons
      if (/^(def|class|if|elif|else|for|while|try|except|with)\s+.*[^:]$/.test(trimmed)) {
        issues.push({
          id: `py-colon-${this.issueIdCounter++}`,
          type: 'syntax',
          severity: 'high',
          category: 'Syntax',
          message: 'Missing colon at end of statement',
          line: idx + 1,
          column: trimmed.length,
          code: trimmed,
          suggestion: 'Add a colon at the end of the statement',
          fixedCode: trimmed + ':',
          confidence: 95,
          impact: 'high',
          effort: 'easy'
        });
      }
      
      // Check for print statements (Python 2 style)
      if (/\bprint\s+[^(]/.test(trimmed)) {
        issues.push({
          id: `py-print-${this.issueIdCounter++}`,
          type: 'version',
          severity: 'medium',
          category: 'Compatibility',
          message: 'Use print() function instead of print statement',
          line: idx + 1,
          column: trimmed.indexOf('print') + 1,
          code: trimmed,
          suggestion: 'Convert to print() function syntax for Python 3 compatibility',
          fixedCode: trimmed.replace(/print\s+(.+)/, 'print($1)'),
          confidence: 90,
          impact: 'medium',
          effort: 'easy'
        });
      }
    });
    
    return issues;
  }

  private analyzeJava(code: string): Issue[] {
    const issues: Issue[] = [];
    const lines = code.split('\n');
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      // Check for missing semicolons
      if (/^(int|String|double|float|boolean|long|char|byte|short)\s+.*[^;{]$/.test(trimmed)) {
        issues.push({
          id: `java-semicolon-${this.issueIdCounter++}`,
          type: 'syntax',
          severity: 'high',
          category: 'Syntax',
          message: 'Missing semicolon at end of statement',
          line: idx + 1,
          column: trimmed.length,
          code: trimmed,
          suggestion: 'Add semicolon at the end of the statement',
          fixedCode: trimmed + ';',
          confidence: 95,
          impact: 'high',
          effort: 'easy'
        });
      }
    });
    
    return issues;
  }

  private analyzeGeneric(code: string): Issue[] {
    return [];
  }

  private async analyzeSecurityPatterns(code: string): Promise<Issue[]> {
    const issues: Issue[] = [];
    const lines = code.split('\n');
    
    // Check for potential security vulnerabilities
    const securityPatterns = [
      { pattern: /eval\s*\(/, message: 'Use of eval() is dangerous', severity: 'critical' as const },
      { pattern: /innerHTML\s*=/, message: 'Direct innerHTML assignment can lead to XSS', severity: 'high' as const },
      { pattern: /document\.write\s*\(/, message: 'document.write can be exploited', severity: 'medium' as const },
      { pattern: /password\s*=\s*["'][^"']+["']/i, message: 'Hardcoded password detected', severity: 'critical' as const },
      { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/i, message: 'Hardcoded API key detected', severity: 'critical' as const }
    ];
    
    lines.forEach((line, idx) => {
      securityPatterns.forEach((pattern) => {
        if (pattern.pattern.test(line)) {
          issues.push({
            id: `sec-${this.issueIdCounter++}`,
            type: 'security',
            severity: pattern.severity,
            category: 'Security',
            message: pattern.message,
            line: idx + 1,
            column: 1,
            code: line.trim(),
            suggestion: 'Review and secure this code pattern',
            fixedCode: '// Security issue - needs manual review',
            confidence: 90,
            impact: 'high',
            effort: 'medium'
          });
        }
      });
    });
    
    return issues;
  }

  private async analyzePerformancePatterns(code: string): Promise<Issue[]> {
    const issues: Issue[] = [];
    
    // Check for nested loops (O(n²) complexity)
    const nestedLoopPattern = /for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/gs;
    if (nestedLoopPattern.test(code)) {
      issues.push({
        id: `perf-nested-${this.issueIdCounter++}`,
        type: 'performance',
        severity: 'medium',
        category: 'Performance',
        message: 'Nested loops detected - potential O(n²) complexity',
        line: 1,
        column: 1,
        code: '',
        suggestion: 'Consider using more efficient algorithms or data structures',
        fixedCode: '// Consider using Map, Set, or other optimized approaches',
        confidence: 80,
        impact: 'medium',
        effort: 'high'
      });
    }
    
    return issues;
  }

  private async analyzeCodeQuality(code: string): Promise<Issue[]> {
    const issues: Issue[] = [];
    const lines = code.split('\n');
    
    // Check for long functions
    let currentFunction = '';
    let functionLineCount = 0;
    let inFunction = false;
    
    lines.forEach((line, idx) => {
      if (/function\s+\w+|def\s+\w+|public\s+.*\s+\w+\s*\(/.test(line)) {
        if (inFunction && functionLineCount > 50) {
          issues.push({
            id: `quality-long-func-${this.issueIdCounter++}`,
            type: 'maintainability',
            severity: 'medium',
            category: 'Code Quality',
            message: 'Function is too long (>50 lines)',
            line: idx - functionLineCount + 1,
            column: 1,
            code: currentFunction,
            suggestion: 'Break down long functions into smaller, focused functions',
            fixedCode: '// Break this function into smaller parts',
            confidence: 85,
            impact: 'medium',
            effort: 'medium'
          });
        }
        
        inFunction = true;
        functionLineCount = 1;
        currentFunction = line.trim();
      } else if (inFunction) {
        functionLineCount++;
        if (line.trim() === '}' || (line.trim() === '' && lines[idx + 1]?.trim() === '')) {
          inFunction = false;
        }
      }
    });
    
    return issues;
  }

  private analyzeDocumentation(code: string): number {
    const lines = code.split('\n');
    let documentedLines = 0;
    
    lines.forEach((line) => {
      if (/\/\*\*|\/\/|#|"""/.test(line.trim())) {
        documentedLines++;
      }
    });
    
    return Math.min(100, Math.round((documentedLines / lines.length) * 100 * 5)); // Boost documentation score
  }

  private analyzeComplexity(code: string): number {
    const complexityPatterns = [
      /\bif\b/g, /\belse\s+if\b/g, /\bfor\b/g, /\bwhile\b/g,
      /\bswitch\b/g, /\bcase\b/g, /\bcatch\b/g, /\?\s*.*\s*:/g
    ];
    
    let complexity = 1;
    complexityPatterns.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  private findDuplicateLines(code: string): number {
    const lines = code.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const lineMap: { [key: string]: number } = {};
    let duplicates = 0;
    
    lines.forEach(line => {
      if (lineMap[line]) {
        duplicates++;
      } else {
        lineMap[line] = 1;
      }
    });
    
    return duplicates;
  }

  private estimateTestCoverage(code: string): number {
    const testPatterns = [/test\(/g, /it\(/g, /describe\(/g, /expect\(/g, /assert/g];
    let testIndicators = 0;
    
    testPatterns.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) {
        testIndicators += matches.length;
      }
    });
    
    return Math.min(100, testIndicators * 10); // Rough estimation
  }

  private generateRecommendations(issues: Issue[], code: string, language: string): string[] {
    const recommendations: string[] = [];
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const securityIssues = issues.filter(i => i.category === 'Security');
    const performanceIssues = issues.filter(i => i.category === 'Performance');
    
    if (criticalIssues.length > 0) {
      recommendations.push(`Urgent: Resolve the ${criticalIssues.length} critical flaws (e.g., ${criticalIssues[0].message.toLowerCase()}) to prevent system failure.`);
    }
    
    if (securityIssues.length > 0) {
      recommendations.push(`Security: Patch detected vulnerabilities in your ${language} code, specifically targeting ${securityIssues[0].category.toLowerCase()} risks.`);
    }

    if (performanceIssues.length > 0) {
      recommendations.push(`Performance: Optimize the logic on lines ${performanceIssues.map(p => p.line).slice(0, 2).join(', ')} to reduce resource consumption.`);
    }
    
    if (code.length > 2000) {
      recommendations.push('Refactor: This file is becoming large. Consider breaking it down into smaller, modular components.');
    }

    if (language === 'javascript' || language === 'typescript') {
      if (!code.includes('import') && !code.includes('require')) {
        recommendations.push('Architecture: Consider using ES Modules for better code organization and tree-shaking.');
      }
    }
    
    // Add a default if needed
    if (recommendations.length < 3) {
      recommendations.push('Stability: Implement comprehensive unit tests for the core logic to prevent regression bugs.');
    }
    
    return recommendations.slice(0, 5);
  }

  private calculateCodeSmells(issues: Issue[], complexity: number): number {
    const smellFactors = [
      issues.filter(i => i.type === 'maintainability').length,
      issues.filter(i => i.type === 'deprecated').length,
      complexity > 10 ? 1 : 0,
      issues.filter(i => i.message.includes('long')).length
    ];
    
    return smellFactors.reduce((sum, factor) => sum + factor, 0);
  }

  private calculateTechnicalDebt(issues: Issue[]): string {
    const effortMap = { easy: 0.5, medium: 2, high: 8 };
    const totalHours = issues.reduce((sum, issue) => {
      return sum + (effortMap[issue.effort as keyof typeof effortMap] || 1);
    }, 0);
    
    const priority = totalHours > 40 ? 'High' : totalHours > 20 ? 'Medium' : 'Low';
    return `Estimated ${totalHours.toFixed(1)} hours to resolve all issues. Priority: ${priority}`;
  }
}

export const codeAnalyzer = AdvancedCodeAnalyzer.getInstance();