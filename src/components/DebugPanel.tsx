import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, limit, query } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity, Database, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

interface CollectionTest {
  name: string;
  read: TestStatus;
  write: TestStatus;
  error?: string;
}

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [tests, setTests] = useState<CollectionTest[]>([
    { name: 'users', read: 'idle', write: 'idle' },
    { name: 'rooms', read: 'idle', write: 'idle' },
    { name: 'matches', read: 'idle', write: 'idle' },
    { name: '_system', read: 'idle', write: 'idle' }
  ]);
  const [isTestingAll, setIsTestingAll] = useState(false);

    const runTest = async (collectionName: string) => {
    setTests(prev => prev.map(t => t.name === collectionName ? { ...t, read: 'testing', write: 'testing', error: undefined } : t));
    
    let readStatus: TestStatus = 'success';
    let writeStatus: TestStatus = 'success';
    let errorMsg = '';

    try {
      // Test Read
      const q = query(collection(db, collectionName), limit(1));
      await getDocs(q);
    } catch (err: any) {
      readStatus = 'error';
      errorMsg = err.message || 'Read failed';
    }

    try {
      // Test Write (Create & Delete a dummy doc)
      const dummyId = `_debug_test_${Date.now()}`;
      const dummyRef = doc(db, collectionName, dummyId);
      
      let dummyData: any = { _debug: true, timestamp: Date.now() };
      
      if (collectionName === 'users') {
        dummyData = {
          uid: dummyId,
          displayName: 'Debug User',
          wins: 0,
          losses: 0,
          xp: 0,
          level: 1,
          matchHistory: [],
          following: [],
          createdAt: Date.now()
        };
      } else if (collectionName === 'matches') {
        dummyData = {
          id: dummyId,
          roomId: 'debug_room',
          participants: ['debug_user'],
          winnerId: 'debug_user',
          endedAt: Date.now()
        };
      }

      await setDoc(dummyRef, dummyData);
      await deleteDoc(dummyRef);
    } catch (err: any) {
      writeStatus = 'error';
      if (!errorMsg) errorMsg = err.message || 'Write failed';
    }

    setTests(prev => prev.map(t => 
      t.name === collectionName 
        ? { ...t, read: readStatus, write: writeStatus, error: errorMsg } 
        : t
    ));
  };

  const runAllTests = async () => {
    setIsTestingAll(true);
    for (const test of tests) {
      await runTest(test.name);
    }
    setIsTestingAll(false);
  };

  useEffect(() => {
    if (isOpen) {
      runAllTests();
    }
  }, [isOpen]);

  const StatusIcon = ({ status }: { status: TestStatus }) => {
    if (status === 'testing') return <Loader2 className="w-3 h-3 animate-spin text-blue-500" />;
    if (status === 'success') return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    if (status === 'error') return <XCircle className="w-3 h-3 text-red-500" />;
    return <div className="w-3 h-3 rounded-full bg-ink/10" />;
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="bg-bg border border-ink/10 rounded-lg shadow-xl p-4 w-80 font-mono text-xs text-ink"
          >
            <div className="flex items-center justify-between mb-4 border-b border-ink/10 pb-2">
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                <Database className="w-4 h-4" />
                <span>DB Connection Debug</span>
              </div>
              <button 
                onClick={runAllTests}
                disabled={isTestingAll}
                className="p-1 hover:bg-ink/5 rounded transition-colors disabled:opacity-50"
                title="Run Tests Again"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingAll ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 text-[10px] uppercase tracking-wider opacity-50 mb-1 px-1">
                <span>Collection</span>
                <span className="text-center">Read</span>
                <span className="text-center">Write</span>
              </div>
              
              {tests.map(test => (
                <div key={test.name} className="flex flex-col gap-1">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center bg-ink/5 p-2 rounded">
                    <span className="font-semibold truncate">{test.name}</span>
                    <div className="flex justify-center w-8">
                      <StatusIcon status={test.read} />
                    </div>
                    <div className="flex justify-center w-8">
                      <StatusIcon status={test.write} />
                    </div>
                  </div>
                  {test.error && (
                    <div className="text-[10px] text-red-500 bg-red-500/10 p-1.5 rounded break-words">
                      {test.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg border ${
          isOpen 
            ? 'bg-ink text-bg border-ink' 
            : 'bg-bg text-ink border-ink/20 hover:border-ink/40'
        }`}
      >
        <Activity className="w-4 h-4" />
        <span>Debug</span>
      </button>
    </div>
  );
}
