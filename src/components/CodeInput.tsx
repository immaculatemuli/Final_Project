import React, { useState } from 'react';
import { Upload, FileText, Link, Play, Loader2, Folder, X, File, CheckCircle } from 'lucide-react';

interface CodeInputProps {
  onAnalyze: (code: string) => void;
  isAnalyzing: boolean;
  code: string;
  setCode: (code: string) => void;
  targetLine?: number | null;
  onLineNavigated?: () => void;
}

interface UploadedFile {
  name: string;
  content: string;
  size: number;
  type: string;
}

export const CodeInput: React.FC<CodeInputProps> = (props) => {
  const { code, setCode, isAnalyzing, onAnalyze, targetLine, onLineNavigated } = props;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [inputMethod, setInputMethod] = useState<'paste' | 'upload' | 'folder' | 'github'>('paste');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.rs', '.html', '.css', '.scss', '.vue', '.svelte', '.json', '.xml', '.yaml', '.yml', '.md', '.txt'];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      processFiles(Array.from(files));
    }
  };

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      processFiles(Array.from(files));
    }
  };

  const processFiles = async (files: File[]) => {
    console.log('Starting optimized file processing...', files.length, 'files');

    setIsUploading(true);
    setUploadProgress(0);

    // Filter files more efficiently
    const codeFiles = files.filter(file => {
      const fileName = file.name.toLowerCase();
      const hasValidExtension = codeExtensions.some(ext => fileName.endsWith(ext));
      const hasTextType = file.type.startsWith('text/') || file.type === '' || file.type === 'application/javascript';
      const isSmallEnough = file.size < 1024 * 1024; // 1MB limit per file
      return (hasValidExtension || hasTextType) && isSmallEnough;
    });

    console.log('Filtered code files:', codeFiles.length);

    if (codeFiles.length === 0) {
      alert('No valid code files found. Please select files with supported extensions (under 1MB each).');
      setIsUploading(false);
      setUploadProgress(0);
      return;
    }

    // Limit number of files to prevent performance issues
    const limitedFiles = codeFiles.slice(0, 20);
    if (limitedFiles.length < codeFiles.length) {
      console.warn(`Processing only first ${limitedFiles.length} files for performance`);
    }

    try {
      const processedFiles: UploadedFile[] = [];
      let combinedCode = '';

      // Process files in batches for better performance
      const batchSize = 5;
      for (let i = 0; i < limitedFiles.length; i += batchSize) {
        const batch = limitedFiles.slice(i, i + batchSize);

        const batchPromises = batch.map(file => {
          return new Promise<UploadedFile | null>((resolve) => {
            const reader = new FileReader();

            reader.onload = (e) => {
              try {
                const content = e.target?.result as string;
                if (content && content.length < 100000) { // 100KB limit per file content
                  resolve({
                    name: file.name,
                    content: content,
                    size: file.size,
                    type: file.type || 'text/plain'
                  });
                } else {
                  console.warn(`File too large or empty: ${file.name}`);
                  resolve(null);
                }
              } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                resolve(null);
              }
            };

            reader.onerror = () => {
              console.error(`Failed to read file: ${file.name}`);
              resolve(null);
            };

            reader.readAsText(file);
          });
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(result => {
          if (result) {
            processedFiles.push(result);
            combinedCode += `\n\n// ==========================================\n// File: ${result.name}\n// ==========================================\n${result.content}`;
          }
        });

        // Update progress
        const progress = Math.round(((i + batch.length) / limitedFiles.length) * 100);
        setUploadProgress(progress);

        // Small delay to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('All files processed successfully');
      setUploadedFiles(processedFiles);
      setCode(combinedCode.trim());
      setUploadProgress(100);

      // Warn if combined code is getting large (approaching 60KB backend limit)
      const sizeKb = (combinedCode.length / 1024).toFixed(1);
      if (combinedCode.length > 50 * 1024) {
        console.warn(`⚠️ Combined code size is ${sizeKb}KB (approaching 60KB backend limit). Consider analyzing fewer files.`);
      }

      // Reset upload state
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);

    } catch (error) {
      console.error('Error during file processing:', error);
      alert('An error occurred while processing files. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);

    if (newFiles.length === 0) {
      setCode('');
    } else {
      const combinedCode = newFiles.map(file =>
        `\n\n// ==========================================\n// File: ${file.name}\n// ==========================================\n${file.content}`
      ).join('');
      setCode(combinedCode.trim());
    }
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
    setCode('');
    setUploadProgress(0);
    setIsUploading(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const sampleCode = `/**
 * Sample JavaScript function for demonstration
 * This function fetches user data and their posts
 * @param {string} userId - The ID of the user to fetch
 * @returns {Promise<Object>} User data with posts
 */
async function fetchUserData(userId) {
  try {
    // Fetch user and posts concurrently for better performance
    const [userResponse, postsResponse] = await Promise.all([
      fetch(\`/api/users/\${userId}\`),
      fetch(\`/api/users/\${userId}/posts\`)
    ]);
    
    if (!userResponse.ok || !postsResponse.ok) {
      throw new Error('Failed to fetch user data');
    }
    
    const userData = await userResponse.json();
    const posts = await postsResponse.json();
    
    return {
      user: userData,
      posts: posts
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}

/**
 * Process user data based on age restrictions
 * @param {Object} data - User data object
 * @returns {Array} Filtered posts array
 */
function processUserData(data) {
  // Check if user is adult
  if (data.user.age >= 18) {
    // Return only published posts for adults
    return data.posts.filter(post => post.published === true);
  }
  
  // Return empty array for minors
  return [];
}`;

  // Handle line navigation
  React.useEffect(() => {
    if (targetLine && textareaRef.current) {
      const el = textareaRef.current;
      const lines = code.split('\n');
      const lineIndex = Math.max(0, targetLine - 1);

      // Calculate scroll position (rough estimate)
      const lineHeight = 20; // approximate line height in px
      const targetScroll = lineIndex * lineHeight;

      el.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });

      // Brief highlight effect
      el.focus();

      // Set cursor to the start of that line
      let charPos = 0;
      for (let i = 0; i < lineIndex && i < lines.length; i++) {
        charPos += lines[i].length + 1;
      }

      const lineLength = lines[lineIndex]?.length || 0;
      el.setSelectionRange(charPos, charPos + lineLength);

      // Reset target after a delay to allow for multiple clicks on the same line
      setTimeout(() => {
        onLineNavigated?.();
      }, 500);
    }
  }, [targetLine, code, onLineNavigated]);

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1).join('\n');

  return (
    <div className="bg-gray-800 text-white rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Code Input</h2>
        <div className="flex space-x-1">
          {(['paste', 'upload', 'folder', 'github'] as const).map(method => (
            <button
              key={method}
              onClick={() => setInputMethod(method)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${inputMethod === method ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {method === 'paste' && <FileText className="w-3 h-3 inline mr-1" />}
              {method === 'upload' && <Upload className="w-3 h-3 inline mr-1" />}
              {method === 'folder' && <Folder className="w-3 h-3 inline mr-1" />}
              {method === 'github' && <Link className="w-3 h-3 inline mr-1" />}
              {method.charAt(0).toUpperCase() + method.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {inputMethod === 'paste' && (
        <div className="space-y-4">
          <div className="relative flex bg-gray-900 border border-gray-700 rounded-lg overflow-hidden h-96 group">
            {/* Extended Line Numbers Gutter */}
            <div
              className="w-12 bg-gray-900/50 border-r border-gray-700/50 p-4 pt-4 text-right select-none font-mono text-sm text-gray-500 overflow-hidden"
              style={{ pointerEvents: 'none' }}
            >
              <pre className="m-0 leading-[20px]">{lineNumbers}</pre>
            </div>

            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here..."
              className="flex-1 h-full p-4 pt-4 bg-transparent text-white font-mono text-sm resize-none focus:outline-none focus:ring-0 leading-[20px] overflow-y-auto custom-scrollbar whitespace-pre"
              spellCheck={false}
              onScroll={(e) => {
                // Sync gutter scroll
                const gutter = e.currentTarget.parentElement?.firstChild as HTMLElement;
                if (gutter) gutter.scrollTop = e.currentTarget.scrollTop;
              }}
            />
          </div>
          <button
            onClick={() => setCode(sampleCode)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Load sample code with documentation
          </button>
        </div>
      )}

      {inputMethod === 'upload' && (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-600 hover:border-gray-500'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-400 mb-2">Drop your code files here or click to browse</p>
            <p className="text-xs text-gray-500 mb-4">Supports: JS, TS, Python, Java, C++, and more (max 1MB per file)</p>
            <input
              type="file"
              accept={codeExtensions.join(',')}
              onChange={handleFileUpload}
              multiple
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
            >
              Choose Files
            </label>
          </div>

          {isUploading && (
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Processing files...</span>
                <span className="text-sm text-gray-400">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {uploadedFiles.length > 0 && !isUploading && (
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Uploaded Files ({uploadedFiles.length})</h3>
                <button
                  onClick={clearAllFiles}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                    <div className="flex items-center space-x-2">
                      <File className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-gray-300 truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {inputMethod === 'folder' && (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-600 hover:border-gray-500'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Folder className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-400 mb-2">Select a folder containing your code files</p>
            <p className="text-xs text-gray-500 mb-4">Processes up to 20 files (max 1MB each) for optimal performance</p>
            <input
              type="file"
              {...{ webkitdirectory: "true", mozdirectory: "true" } as React.InputHTMLAttributes<HTMLInputElement>}
              multiple
              onChange={handleFolderUpload}
              className="hidden"
              id="folder-upload"
            />
            <label
              htmlFor="folder-upload"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
            >
              Choose Folder
            </label>
          </div>

          {isUploading && (
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Processing folder...</span>
                <span className="text-sm text-gray-400">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {uploadedFiles.length > 0 && !isUploading && (
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Folder Contents ({uploadedFiles.length} files)</h3>
                <button
                  onClick={clearAllFiles}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                    <div className="flex items-center space-x-2">
                      <File className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-gray-300 truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {inputMethod === 'github' && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Enter GitHub repository URL or file URL..."
            className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-400">
            Example: https://github.com/user/repo/blob/main/src/index.js
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {code ? (
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>{code.length.toLocaleString()} characters ready</span>
              {uploadedFiles.length > 0 && (
                <span className="text-gray-500">• {uploadedFiles.length} files</span>
              )}
            </div>
          ) : (
            'No code provided'
          )}
        </div>
        <button
          onClick={() => onAnalyze(code)}
          disabled={!code || isAnalyzing || isUploading}
          className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg"
        >
          {isAnalyzing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          <span className="font-medium">
            {isAnalyzing ? 'Analyzing...' : isUploading ? 'Processing...' : 'Analyze Code'}
          </span>
        </button>
      </div>
    </div>
  );
};