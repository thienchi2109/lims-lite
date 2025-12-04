import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  Plus, 
  CheckCircle2, 
  Dna, 
  FlaskConical, 
  Activity,
  Microscope,
  AlertCircle
} from 'lucide-react';

// --- Interfaces ---
interface TestItem {
    code: string;
    name: string;
    category: string;
    price: number;
    description?: string;
}

interface TestAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    sampleId: string;
    existingTests?: { code: string }[]; // To filter out already assigned tests
    onSave: (selectedTests: TestItem[]) => void;
}

// --- Mock Catalog Data (Usually fetched from API) ---
const TEST_CATALOG: TestItem[] = [
    { code: 'CBC', name: 'Complete Blood Count', category: 'Hematology', price: 150000, description: 'RBC, WBC, Platelets, Hb, Hct' },
    { code: 'ESR', name: 'Erythrocyte Sedimentation Rate', category: 'Hematology', price: 50000 },
    { code: 'GLU', name: 'Glucose Fasting', category: 'Biochemistry', price: 40000 },
    { code: 'HBA1C', name: 'HbA1c', category: 'Biochemistry', price: 120000 },
    { code: 'LIPID', name: 'Lipid Profile', category: 'Biochemistry', price: 200000, description: 'Cholesterol, Triglycerides, HDL, LDL' },
    { code: 'LFT', name: 'Liver Function Test', category: 'Biochemistry', price: 180000 },
    { code: 'KFT', name: 'Kidney Function Test', category: 'Biochemistry', price: 160000 },
    { code: 'CRP', name: 'C-Reactive Protein', category: 'Immunology', price: 80000 },
    { code: 'TSH', name: 'Thyroid Stimulating Hormone', category: 'Immunology', price: 100000 },
    { code: 'UA', name: 'Urinalysis', category: 'Clinical Pathology', price: 60000 },
    { code: 'CULT', name: 'Blood Culture', category: 'Microbiology', price: 350000 },
    { code: 'SEDI', name: 'Urine Sediment', category: 'Clinical Pathology', price: 45000 },
];

/**
 * TestAssignmentModule
 * A standalone modal component for searching, filtering, and assigning laboratory tests to a sample.
 */
const TestAssignmentModule: React.FC<TestAssignmentModalProps> = ({ 
    isOpen, 
    onClose, 
    sampleId, 
    existingTests = [], 
    onSave 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTests, setSelectedTests] = useState<TestItem[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [showConfirmToast, setShowConfirmToast] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedTests([]);
            setSearchTerm('');
            setActiveCategory('All');
        }
    }, [isOpen]);

    // Derived state: Unique Categories
    const categories = ['All', ...Array.from(new Set(TEST_CATALOG.map(t => t.category)))];

    // Derived state: Filtered Tests
    const availableTests = TEST_CATALOG.filter(test => {
        const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              test.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'All' || test.category === activeCategory;
        const isNotAssigned = !existingTests.some((et) => et.code === test.code);
        return matchesSearch && matchesCategory && isNotAssigned;
    });

    const toggleTestSelection = (test: TestItem) => {
        if (selectedTests.find(t => t.code === test.code)) {
            setSelectedTests(prev => prev.filter(t => t.code !== test.code));
        } else {
            setSelectedTests(prev => [...prev, test]);
        }
    };

    const handleSave = () => {
        onSave(selectedTests);
        // Optional: Animation or cleanup before closing could go here
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 ring-1 ring-slate-900/5">
                
                {/* --- HEADER --- */}
                <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-white">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Microscope className="w-6 h-6 text-indigo-600" />
                            Assign Tests
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Assigning protocols to Sample ID: <span className="font-mono font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{sampleId}</span>
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* --- BODY --- */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* LEFT PANEL: CATALOG */}
                    <div className="w-8/12 flex flex-col border-r border-slate-200 bg-slate-50/30">
                        {/* Search & Filter Toolbar */}
                        <div className="p-4 border-b border-slate-200 bg-white space-y-4">
                            <div className="relative group">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input 
                                    type="text" 
                                    placeholder="Search by test code (e.g. CBC) or name..." 
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            
                            {/* Category Chips */}
                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200">
                                {categories.map(cat => (
                                    <button 
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                                            activeCategory === cat 
                                            ? 'bg-indigo-600 text-white shadow-md transform scale-105' 
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Test Grid */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3">
                                {availableTests.map(test => {
                                    const isSelected = selectedTests.some(t => t.code === test.code);
                                    return (
                                        <div 
                                            key={test.code}
                                            onClick={() => toggleTestSelection(test)}
                                            className={`
                                                relative p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col gap-2 group
                                                ${isSelected 
                                                    ? 'bg-indigo-50/80 border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                                                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5'
                                                }
                                            `}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2.5 rounded-lg ${isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {test.category === 'Hematology' ? <Dna className="w-5 h-5" /> : 
                                                         test.category === 'Biochemistry' ? <FlaskConical className="w-5 h-5" /> : 
                                                         <Activity className="w-5 h-5" />}
                                                    </div>
                                                    <div>
                                                        <span className={`text-base font-bold block ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                                                            {test.code}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">
                                                            {test.category}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {/* Checkbox Visual */}
                                                <div className={`
                                                    w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                                    ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}
                                                `}>
                                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                                                </div>
                                            </div>
                                            
                                            <div className="mt-1">
                                                <p className="text-sm text-slate-600 font-medium line-clamp-1">{test.name}</p>
                                                {test.description && (
                                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{test.description}</p>
                                                )}
                                            </div>

                                            <div className="mt-2 pt-2 border-t border-slate-100/50 flex justify-between items-center">
                                                 <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(test.price)}
                                                 </span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {availableTests.length === 0 && (
                                    <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                        <Filter className="w-10 h-10 mb-3 opacity-30" />
                                        <p className="text-lg font-medium text-slate-500">No tests found</p>
                                        <p className="text-sm">Try adjusting your search or category filter</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: SUMMARY & ACTIONS */}
                    <div className="w-4/12 flex flex-col bg-white border-l border-slate-200 shadow-xl z-10">
                        <div className="p-5 border-b border-slate-100 bg-slate-50">
                            <h3 className="font-bold text-slate-700 flex items-center justify-between">
                                <span>Pending Assignment</span>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${selectedTests.length > 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    {selectedTests.length}
                                </span>
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                            {selectedTests.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 px-4 text-center">
                                    <Activity className="w-12 h-12 mb-3 text-slate-200" />
                                    <p className="text-sm font-medium text-slate-500">Selection Empty</p>
                                    <p className="text-xs mt-1">Browse the catalog on the left and click to add tests to this list.</p>
                                </div>
                            ) : (
                                selectedTests.map(test => (
                                    <div key={test.code} className="group bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all flex justify-between items-center animate-in slide-in-from-right-5 duration-300">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-1 h-8 bg-indigo-500 rounded-full flex-shrink-0"></div>
                                            <div className="overflow-hidden">
                                                <span className="font-bold text-slate-700 text-sm block">{test.code}</span>
                                                <span className="text-xs text-slate-500 block truncate">{test.name}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => toggleTestSelection(test)}
                                            className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                            title="Remove"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Totals & Action Buttons */}
                        <div className="p-5 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                             <div className="flex justify-between items-end mb-6">
                                 <span className="text-sm font-medium text-slate-500">Estimated Total</span>
                                 <span className="font-bold text-slate-800 text-2xl">
                                     {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedTests.reduce((acc, t) => acc + t.price, 0))}
                                 </span>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={onClose}
                                    className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors focus:ring-2 focus:ring-slate-200"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSave}
                                    disabled={selectedTests.length === 0}
                                    className={`
                                        px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-all flex items-center justify-center gap-2
                                        ${selectedTests.length === 0 
                                            ? 'bg-slate-300 cursor-not-allowed' 
                                            : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                                        }
                                    `}
                                >
                                    <Plus className="w-4 h-4" />
                                    Confirm Assign
                                </button>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TestAssignmentModule;