import React from 'react';
import { Code, Zap, Shield, GitBranch, ArrowRight, Check } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const features = [
    {
      icon: Code,
      title: 'Code Snippet Analysis',
      description: 'Paste your code and get instant comprehensive analysis with quality metrics and improvement suggestions.',
    },
    {
      icon: GitBranch,
      title: 'GitHub Repository Analysis',
      description: 'Analyze entire repositories with a single URL. Get insights across multiple files and identify patterns.',
    },
    {
      icon: Shield,
      title: 'Security & Performance',
      description: 'Detect security vulnerabilities and performance bottlenecks with detailed vulnerability reports.',
    },
    {
      icon: Zap,
      title: 'AI-Powered Suggestions',
      description: 'Receive actionable code improvement suggestions powered by advanced AI analysis algorithms.',
    },
  ];

  const benefits = [
    'Real-time code quality scoring',
    'Multi-language support',
    'Historical analysis tracking',
    'Detailed issue categorization',
    'Export analysis reports',
    'Team-friendly dashboard',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full bg-black/20 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Code className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Intellicode
            </span>
          </div>
          <button
            onClick={onGetStarted}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Hero Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-block">
                  <span className="text-sm font-semibold text-blue-400 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
                    ✨ AI-Powered Code Intelligence
                  </span>
                </div>
                <h1 className="text-5xl sm:text-6xl font-bold leading-tight">
                  Write Better Code with{' '}
                  <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Intellicode
                  </span>
                </h1>
                <p className="text-xl text-gray-300 leading-relaxed">
                  Transform your code quality with AI-powered analysis. Get instant feedback, security insights, and actionable recommendations to improve your codebase.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onGetStarted}
                  className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center justify-center space-x-2 shadow-lg hover:shadow-blue-500/50"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold text-lg transition-all">
                  Watch Demo
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-6 pt-8">
                <div>
                  <div className="text-3xl font-bold text-blue-400">10K+</div>
                  <p className="text-gray-400 text-sm">Code Reviews</p>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-400">98%</div>
                  <p className="text-gray-400 text-sm">Accuracy Rate</p>
                </div>
                <div>
                  <div className="text-3xl font-bold text-pink-400">500+</div>
                  <p className="text-gray-400 text-sm">Active Users</p>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl"></div>
              <div className="relative bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="space-y-2 font-mono text-sm text-gray-300">
                  <div className="text-blue-400">{'function analyzeCode() {'}</div>
                  <div className="ml-4 text-purple-400">{'// AI-powered analysis'}</div>
                  <div className="ml-4 text-green-400">{'return insights'}</div>
                  <div className="text-blue-400">{'}'}</div>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center space-x-2">
                    <Check className="w-5 h-5 text-green-400" />
                    <span className="text-green-400">Analysis Complete</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-gray-400">
                    <div>✓ 0 Critical Issues</div>
                    <div>✓ 2 Medium Issues</div>
                    <div>✓ Quality Score: 92/100</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-black/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold">
              Powerful Features for Modern Development
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Everything you need to write better, more secure, and more maintainable code.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="group bg-slate-800/50 backdrop-blur border border-white/10 hover:border-blue-500/50 rounded-2xl p-8 transition-all hover:bg-slate-800/80 hover:shadow-lg hover:shadow-blue-500/10 transform hover:-translate-y-2"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:from-blue-600 group-hover:to-purple-600 transition-colors">
                    <Icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h2 className="text-4xl sm:text-5xl font-bold">
                Why Choose Intellicode?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-lg text-gray-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl"></div>
              <div className="relative bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur border border-white/10 rounded-2xl p-8 space-y-6">
                <div className="space-y-2">
                  <div className="w-full h-2 bg-gradient-to-r from-blue-500/20 to-transparent rounded-full"></div>
                  <div className="text-sm text-gray-400">Code Quality</div>
                  <div className="text-3xl font-bold text-blue-400">92/100</div>
                </div>

                <div className="space-y-2">
                  <div className="w-4/5 h-2 bg-gradient-to-r from-purple-500/20 to-transparent rounded-full"></div>
                  <div className="text-sm text-gray-400">Performance</div>
                  <div className="text-3xl font-bold text-purple-400">87/100</div>
                </div>

                <div className="space-y-2">
                  <div className="w-3/5 h-2 bg-gradient-to-r from-pink-500/20 to-transparent rounded-full"></div>
                  <div className="text-sm text-gray-400">Security</div>
                  <div className="text-3xl font-bold text-pink-400">95/100</div>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <p className="text-gray-400 text-sm">Last analysis: 2 minutes ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-white/20 rounded-3xl p-12 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-10 blur-3xl"></div>
            <div className="relative space-y-8 text-center">
              <h2 className="text-4xl sm:text-5xl font-bold">
                Ready to Improve Your Code?
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Join thousands of developers using Intellicode to write better, more secure code. Start your free analysis today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <button
                  onClick={onGetStarted}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-blue-500/50"
                >
                  Get Started Free
                </button>
                <button className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold text-lg transition-all">
                  Learn More
                </button>
              </div>
              <p className="text-gray-400 text-sm">
                No credit card required. Start analyzing in seconds.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold">Intellicode</span>
              </div>
              <p className="text-gray-400 text-sm">AI-powered code analysis for modern development.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition">Features</a></li>
                <li><a href="#" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                <li><a href="#" className="hover:text-white transition">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center text-gray-400 text-sm">
            <p>&copy; 2026 Intellicode. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 sm:mt-0">
              <a href="#" className="hover:text-white transition">Twitter</a>
              <a href="#" className="hover:text-white transition">GitHub</a>
              <a href="#" className="hover:text-white transition">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
