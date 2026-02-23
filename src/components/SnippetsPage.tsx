import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import {
    Bookmark,
    Trash2,
    Calendar,
    Zap,
    Search,
    ArrowLeft
} from 'lucide-react';

interface Snippet {
    id: string;
    code: string;
    analysis: any;
    createdAt: any;
}

interface SnippetsPageProps {
    user: User;
    onNavigate: (page: 'home' | 'history' | 'snippets') => void;
    onRestoreSnippet: (code: string, analysis: any) => void;
}

export const SnippetsPage: React.FC<SnippetsPageProps> = ({ user, onNavigate, onRestoreSnippet }) => {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const q = query(
            collection(db, 'bookmarks'),
            where('uid', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsub = onSnapshot(q, (snap) => {
            const docs = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Snippet[];
            setSnippets(docs);
            setLoading(false);
        });

        return () => unsub();
    }, [user.uid]);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this snippet?')) {
            await deleteDoc(doc(db, 'bookmarks', id));
        }
    };

    const filteredSnippets = snippets.filter(s =>
        s.analysis.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => onNavigate('home')}
                            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Bookmark className="w-6 h-6 text-blue-400" />
                                Snippet Library
                            </h1>
                            <p className="text-slate-400 text-sm">Your saved code transformations and analyses</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search snippets..."
                            className="pl-10 pr-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : filteredSnippets.length === 0 ? (
                    <div className="text-center py-20 bg-slate-800/50 rounded-2xl border border-white/10">
                        <Bookmark className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">No snippets found in your library.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSnippets.map((s) => (
                            <div
                                key={s.id}
                                onClick={() => onRestoreSnippet(s.code, s.analysis)}
                                className="group bg-slate-800 border border-white/10 rounded-xl p-5 hover:border-blue-500/50 transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] font-bold uppercase tracking-wider">
                                        {s.analysis.language}
                                    </span>
                                    <button
                                        onClick={(e) => handleDelete(s.id, e)}
                                        className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`text-2xl font-bold ${s.analysis.overallScore >= 80 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                            {s.analysis.overallScore}%
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Score</div>
                                    </div>
                                    <pre className="text-[11px] font-mono text-slate-400 bg-slate-900/50 p-3 rounded border border-white/5 line-clamp-3 overflow-hidden">
                                        {s.code}
                                    </pre>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-auto pt-4 border-t border-white/5">
                                    <span className="flex items-center gap-1">
                                        <Zap className="w-3 h-3" /> {s.analysis.summary.totalIssues} Issues
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> {s.createdAt?.toDate().toLocaleDateString() || 'Recently'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
