class PythonEditor {
    constructor() {
        this.pyodide = null;
        this.isLoading = true;
        this.isRunning = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadPyodide();
        this.updateLineNumbers();
    }

    initializeElements() {
        this.codeEditor = document.getElementById('codeEditor');
        this.output = document.getElementById('output');
        this.runBtn = document.getElementById('runBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.clearOutputBtn = document.getElementById('clearOutputBtn');
        this.exampleBtn = document.getElementById('exampleBtn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.lineNumbers = document.getElementById('lineNumbers');
        this.fontSize = document.getElementById('fontSize');
        this.wrapBtn = document.getElementById('wrapBtn');
        this.progressBar = document.getElementById('progressBar');
    }

    setupEventListeners() {
        this.runBtn.addEventListener('click', () => this.runCode());
        this.clearBtn.addEventListener('click', () => this.clearEditor());
        this.clearOutputBtn.addEventListener('click', () => this.clearOutput());
        this.exampleBtn.addEventListener('click', () => this.loadExample());
        
        this.codeEditor.addEventListener('input', () => this.updateLineNumbers());
        this.codeEditor.addEventListener('scroll', () => this.syncLineNumbers());
        this.codeEditor.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        this.fontSize.addEventListener('change', () => this.changeFontSize());
        this.wrapBtn.addEventListener('click', () => this.toggleWordWrap());
        
        // Auto-resize textarea
        this.codeEditor.addEventListener('input', () => this.autoResize());
    }

    async loadPyodide() {
        try {
            this.updateStatus('Loading Python environment...', 'loading');
            this.updateProgress(20);
            
            // Load Pyodide
            this.pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
            });
            
            this.updateProgress(60);
            
            // Install common packages
            await this.pyodide.loadPackage(['numpy', 'matplotlib']);
            
            this.updateProgress(90);
            
            // Setup stdout capture
            this.pyodide.runPython(`
import sys
from io import StringIO
import contextlib

class OutputCapture:
    def __init__(self):
        self.output = StringIO()
    
    def write(self, text):
        self.output.write(text)
    
    def flush(self):
        pass
    
    def get_output(self):
        return self.output.getvalue()
    
    def clear(self):
        self.output = StringIO()

_output_capture = OutputCapture()
            `);
            
            this.updateProgress(100);
            this.isLoading = false;
            this.hideLoading();
            this.updateStatus('Ready', 'ready');
            this.runBtn.disabled = false;
            
            this.addOutput('Python environment loaded successfully! 🐍\nYou can now run Python code.\n\n', 'success-output');
            
        } catch (error) {
            this.isLoading = false;
            this.hideLoading();
            this.updateStatus('Error loading Python', 'error');
            this.addOutput(`Error loading Python environment: ${error.message}\n`, 'error-output');
            console.error('Failed to load Pyodide:', error);
        }
    }

    async runCode() {
        if (this.isLoading || this.isRunning) return;
        
        const code = this.codeEditor.value.trim();
        if (!code) {
            this.addOutput('No code to run.\n', 'error-output');
            return;
        }

        this.isRunning = true;
        this.runBtn.disabled = true;
        this.updateStatus('Running...', 'loading');
        
        try {
            // Clear previous output capture
            this.pyodide.runPython('_output_capture.clear()');
            
            // Redirect stdout to our capture
            this.pyodide.runPython(`
sys.stdout = _output_capture
sys.stderr = _output_capture
            `);
            
            // Add separator
            this.addOutput(`${'='.repeat(50)}\n`, 'success-output');
            this.addOutput(`Running code...\n\n`);
            
            // Run the user code
            const startTime = performance.now();
            await this.pyodide.runPythonAsync(code);
            const endTime = performance.now();
            
            // Get captured output
            const output = this.pyodide.runPython('_output_capture.get_output()');
            
            // Restore stdout
            this.pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
            `);
            
            if (output) {
                this.addOutput(output);
            } else {
                this.addOutput('Code executed successfully (no output)\n', 'success-output');
            }
            
            const executionTime = (endTime - startTime).toFixed(2);
            this.addOutput(`\nExecution completed in ${executionTime}ms\n`, 'success-output');
            
        } catch (error) {
            // Restore stdout in case of error
            this.pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
            `);
            
            this.addOutput(`Error: ${error.message}\n`, 'error-output');
            console.error('Python execution error:', error);
        } finally {
            this.isRunning = false;
            this.runBtn.disabled = false;
            this.updateStatus('Ready', 'ready');
        }
    }

    clearEditor() {
        this.codeEditor.value = '';
        this.updateLineNumbers();
        this.codeEditor.focus();
    }

    clearOutput() {
        this.output.textContent = '';
    }

    loadExample() {
        const examples = [
            `# Basic Python Example
print("Hello, Python in the browser!")
print("=" * 30)

# Variables and data types
name = "Python"
version = 3.11
is_awesome = True

print(f"Language: {name}")
print(f"Version: {version}")
print(f"Is awesome: {is_awesome}")

# Lists and loops
numbers = [1, 2, 3, 4, 5]
print(f"\\nNumbers: {numbers}")

squares = [x**2 for x in numbers]
print(f"Squares: {squares}")

# Functions
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(f"\\nFibonacci sequence:")
for i in range(8):
    print(f"F({i}) = {fibonacci(i)}")`,

            `# Math and NumPy Example
import math
import numpy as np

print("Math Operations:")
print(f"π = {math.pi:.6f}")
print(f"e = {math.e:.6f}")
print(f"√2 = {math.sqrt(2):.6f}")

print("\\nNumPy Array Operations:")
arr = np.array([1, 2, 3, 4, 5])
print(f"Array: {arr}")
print(f"Mean: {np.mean(arr):.2f}")
print(f"Standard deviation: {np.std(arr):.2f}")

# Matrix operations
matrix = np.array([[1, 2], [3, 4]])
print(f"\\nMatrix:\\n{matrix}")
print(f"Determinant: {np.linalg.det(matrix):.2f}")
print(f"Inverse:\\n{np.linalg.inv(matrix)}")`,

            `# Data Processing Example
import numpy as np

# Generate sample data
np.random.seed(42)
data = np.random.normal(100, 15, 1000)

print("Data Analysis:")
print(f"Sample size: {len(data)}")
print(f"Mean: {np.mean(data):.2f}")
print(f"Median: {np.median(data):.2f}")
print(f"Standard deviation: {np.std(data):.2f}")
print(f"Min: {np.min(data):.2f}")
print(f"Max: {np.max(data):.2f}")

# Percentiles
percentiles = [25, 50, 75, 90, 95]
print(f"\\nPercentiles:")
for p in percentiles:
    value = np.percentile(data, p)
    print(f"{p}th percentile: {value:.2f}")

# Count values in ranges
ranges = [(0, 70), (70, 85), (85, 100), (100, 115), (115, 130), (130, 200)]
print(f"\\nValue distribution:")
for low, high in ranges:
    count = np.sum((data >= low) & (data < high))
    percentage = (count / len(data)) * 100
    print(f"{low}-{high}: {count} values ({percentage:.1f}%)")`
        ];

        const randomExample = examples[Math.floor(Math.random() * examples.length)];
        this.codeEditor.value = randomExample;
        this.updateLineNumbers();
        this.codeEditor.focus();
    }

    addOutput(text, className = '') {
        const span = document.createElement('span');
        span.textContent = text;
        if (className) {
            span.className = className;
        }
        this.output.appendChild(span);
        this.output.scrollTop = this.output.scrollHeight;
    }

    updateStatus(text, type = 'ready') {
        this.statusIndicator.textContent = text;
        this.statusIndicator.className = `status-indicator ${type}`;
    }

    updateProgress(percentage) {
        this.progressBar.style.width = `${percentage}%`;
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    updateLineNumbers() {
        const lines = this.codeEditor.value.split('\n');
        const lineCount = lines.length;
        
        let lineNumbersHtml = '';
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHtml += i + '\n';
        }
        
        this.lineNumbers.textContent = lineNumbersHtml;
    }

    syncLineNumbers() {
        this.lineNumbers.scrollTop = this.codeEditor.scrollTop;
    }

    handleKeyDown(e) {
        // Tab key handling
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.codeEditor.selectionStart;
            const end = this.codeEditor.selectionEnd;
            
            this.codeEditor.value = this.codeEditor.value.substring(0, start) + 
                                   '    ' + 
                                   this.codeEditor.value.substring(end);
            
            this.codeEditor.selectionStart = this.codeEditor.selectionEnd = start + 4;
            this.updateLineNumbers();
        }
        
        // Ctrl+Enter to run code
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.runCode();
        }
    }

    changeFontSize() {
        const size = this.fontSize.value + 'px';
        this.codeEditor.style.fontSize = size;
        this.lineNumbers.style.fontSize = size;
    }

    toggleWordWrap() {
        const isWrapped = this.codeEditor.style.whiteSpace === 'pre-wrap';
        this.codeEditor.style.whiteSpace = isWrapped ? 'pre' : 'pre-wrap';
        this.wrapBtn.textContent = isWrapped ? 'Wrap' : 'No Wrap';
    }

    autoResize() {
        // Auto-resize functionality could be added here if needed
        this.updateLineNumbers();
    }
}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PythonEditor();
});

// Add some helpful keyboard shortcuts info
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        alert('Keyboard Shortcuts:\n\n' +
              'Ctrl+Enter: Run code\n' +
              'Tab: Insert 4 spaces\n' +
              'Ctrl+/: Show this help');
    }
});