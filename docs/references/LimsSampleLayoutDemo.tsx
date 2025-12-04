import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Beaker, 
  FileText, 
  Activity, 
  Calendar, 
  User, 
  AlertCircle,
  CheckCircle2,
  Clock,
  Microscope,
  X,
  Plus,
  FlaskConical,
  Dna
} from 'lucide-react';

// --- Types ---
interface Test {
  id: string;
  code: string;
  name: string;
  status: 'pending' | 'completed' | 'processing';
  category?: string; // Added category for the catalog
}

interface Sample {
  id: string;
  sampleId: string;
  patientName: string;
  collectionDate: string;
  type: string;
  priority: 'Routine' | 'Stat' | 'Urgent';
  status: 'Registered' | 'Received' | 'In Progress' | 'Completed';
  tests: Test[];
}

// --- Mock Data ---
const MOCK_SAMPLES: Sample[] = [
  {
    id: '1',
    sampleId: 'SMP-2023-001',
    patientName: 'Nguyen Van A',
    collectionDate: '2023-10-25 08:30',
    type: 'Blood (Whole)',
    priority: 'Routine',
    status: 'In Progress',
    tests: [
      { id: 't1', code: 'CBC', name: 'Complete Blood Count', status: 'completed', category: 'Hematology' },
      { id: 't2', code: 'GLU', name: 'Glucose Fasting', status: 'processing', category: 'Biochemistry' },
      { id: 't3', code: 'HBA1C', name: 'HbA1c', status: 'pending', category: 'Biochemistry' },
    ]
  },
  {
    id: '2',
    sampleId: 'SMP-2023-002',
    patientName: 'Le Thi B',
    collectionDate: '2023-10-25 09:15',
    type: 'Urine',
    priority: 'Stat',
    status: 'Received',
    tests: [
      { id: 't4', code: 'UA', name: 'Urinalysis', status: 'pending', category: 'Biochemistry' },
    ]
  },
  {
    id: '3',
    sampleId: 'SMP-2023-003',
    patientName: 'Tran Van C',
    collectionDate: '2023-10-25 10:00',
    type: 'Serum',
    priority: 'Routine',
    status: 'Registered',
    tests: [] // Case: No tests assigned
  },
  {
    id: '4',
    sampleId: 'SMP-2023-004',
    patientName: 'Pham Thi D',
    collectionDate: '2023-10-25 10:45',
    type: 'Blood (EDTA)',
    priority: 'Urgent',
    status: 'Completed',
    tests: [
      { id: 't5', code: 'CRP', name: 'C-Reactive Protein', status: 'completed', category: 'Immunology' },
      { id: 't6', code: 'ESR', name: 'Erythrocyte Sedimentation Rate', status: 'completed', category: 'Hematology' },
    ]
  },
  {
    id: '5',
    sampleId: 'SMP-2023-005',
    patientName: 'Hoang Van E',
    collectionDate: '2023-10-25 11:00',
    type: 'Plasma',
    priority: 'Routine',
    status: 'Registered',
    tests: []
  },
   // Adding more dummy rows to demonstrate scrolling
  ...Array.from({ length: 10 }).map((_, i) => ({
    id: `dummy-${i}`,
    sampleId: `SMP-2023-0${10 + i}`,
    patientName: `Patient Placeholder ${i + 1}`,
    collectionDate: '2023-10-26 07:00',
    type: 'N/A',
    priority: 'Routine' as const,
    status: 'Registered' as const,
    tests: []
  }))
];

// --- TEST CATALOG MOCK DATA (For the modal) ---
const TEST_CATALOG = [
    { code: 'CBC', name: 'Complete Blood Count', category: 'Hematology', price: 150000 },
    { code: 'ESR', name: 'Erythrocyte Sedimentation Rate', category: 'Hematology', price: 50000 },
    { code: 'GLU', name: 'Glucose Fasting', category: 'Biochemistry', price: 40000 },
    { code: 'HBA1C', name: 'HbA1c', category: 'Biochemistry', price: 120000 },
    { code: 'LIPID', name: 'Lipid Profile', category: 'Biochemistry', price: 200000 },
    { code: 'LFT', name: 'Liver Function Test', category: 'Biochemistry', price: 180000 },
    { code: 'KFT', name: 'Kidney Function Test', category: 'Biochemistry', price: 160000 },
    { code: 'CRP', name: 'C-Reactive Protein', category: 'Immunology', price: 80000 },
    { code: 'TSH', name: 'Thyroid Stimulating Hormone', category: 'Immunology', price: 100000 },
    { code: 'UA', name: 'Urinalysis', category: 'Clinical Pathology', price: 60000 },
];

const LimsSampleLayout = () => {
  const [samples, setSamples] = useState<Sample[]>(MOCK_SAMPLES);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(MOCK_SAMPLES[0].id);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const selectedSample = samples.find(s => s.id === selectedSampleId);

  // Helper for status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Received': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Registered': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'Stat' || priority === 'Urgent') return 'text-red-600 font-semibold';
    return 'text-slate-600';
  };

  const handleAddTests = (newTests: any[]) => {
      if (!selectedSampleId) return;

      const formattedTests: Test[] = newTests.map((t, idx) => ({
          id: `new-${Date.now()}-${idx}`,
          code: t.code,
          name: t.name,
          status: 'pending',
          category: t.category
      }));

      setSamples(prev => prev.map(s => {
          if (s.id === selectedSampleId) {
              return { ...s, tests: [...s.tests, ...formattedTests] };
          }
          return s;
      }));
      setIsTestModalOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      
      {/* --- TOP ROW: Data Grid (50% Height) --- */}
      <div className="h-1/2 flex flex-col bg-white border-b border-slate-300 shadow-sm z-10">
        
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Beaker className="w-5 h-5 text-indigo-600" />
              Sample Management
            </h2>
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full border border-slate-200">
              {samples.length} Records
            </span>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search sample ID, patient..." 
                className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
              />
            </div>
            <button className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-50 text-slate-600">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Data Grid Container */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">Sample ID</th>
                <th className="px-4 py-3 border-b border-slate-200">Patient Name</th>
                <th className="px-4 py-3 border-b border-slate-200">Type</th>
                <th className="px-4 py-3 border-b border-slate-200">Date</th>
                <th className="px-4 py-3 border-b border-slate-200">Priority</th>
                <th className="px-4 py-3 border-b border-slate-200">Status</th>
                <th className="px-4 py-3 border-b border-slate-200 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {samples.map((sample) => (
                <tr 
                  key={sample.id}
                  onClick={() => setSelectedSampleId(sample.id)}
                  className={`
                    cursor-pointer transition-colors duration-150
                    ${selectedSampleId === sample.id ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-slate-50'}
                  `}
                >
                  <td className="px-4 py-2.5 font-medium text-indigo-600">{sample.sampleId}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{sample.patientName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{sample.type}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{sample.collectionDate}</td>
                  <td className={`px-4 py-2.5 text-xs ${getPriorityColor(sample.priority)}`}>
                    {sample.priority}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(sample.status)}`}>
                      {sample.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-400">
                    <MoreHorizontal className="w-4 h-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- BOTTOM ROW: Split View (Remaining Height) --- */}
      <div className="h-1/2 flex flex-row bg-slate-50">
        
        {/* LEFT PANEL: Sample Details */}
        <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Sample Details
            </h3>
            {selectedSample && (
               <button className="text-xs text-indigo-600 hover:underline">Edit Info</button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            {selectedSample ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <DetailItem label="Sample ID" value={selectedSample.sampleId} highlight />
                <DetailItem label="Current Status" value={selectedSample.status} isBadge badgeColor={getStatusColor(selectedSample.status)} />
                
                <div className="col-span-2 border-b border-slate-100 my-1"></div>
                
                <DetailItem label="Patient Name" value={selectedSample.patientName} icon={<User className="w-3.5 h-3.5" />} />
                <DetailItem label="Specimen Type" value={selectedSample.type} icon={<Beaker className="w-3.5 h-3.5" />} />
                <DetailItem label="Collection Date" value={selectedSample.collectionDate} icon={<Calendar className="w-3.5 h-3.5" />} />
                <DetailItem label="Priority" value={selectedSample.priority} />
                
                <div className="col-span-2 border-b border-slate-100 my-1"></div>
                
                <div className="col-span-2">
                   <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Internal Notes</p>
                   <p className="text-sm text-slate-600 italic">Sample received in good condition. No visible hemolysis.</p>
                </div>
              </div>
            ) : (
              <EmptyState message="Select a sample to view details" />
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Assigned Tests */}
        <div className="w-1/2 flex flex-col bg-slate-50/50">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              Assigned Tests
            </h3>
            {selectedSample && (
              <button 
                onClick={() => setIsTestModalOpen(true)}
                className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Test
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!selectedSample ? (
              <EmptyState message="Select a sample to view tests" />
            ) : selectedSample.tests.length === 0 ? (
              // EMPTY STATE FOR TESTS
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                <Microscope className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No tests assigned yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                  Use the "Add Test" button to assign new analysis protocols to this sample.
                </p>
              </div>
            ) : (
              // TEST LIST
              <div className="space-y-3">
                {selectedSample.tests.map((test) => (
                  <div key={test.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between hover:border-indigo-300 transition-colors cursor-default group">
                    <div className="flex items-start gap-3">
                       {/* Icon based on category or status */}
                      <div className={`mt-1 w-2 h-2 rounded-full ${
                        test.status === 'completed' ? 'bg-emerald-500' : 
                        test.status === 'processing' ? 'bg-blue-500 animate-pulse' : 'bg-amber-400'
                      }`} />
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">{test.code}</span>
                          <span className="text-xs text-slate-400 font-mono">#{test.id.split('-').pop()}</span>
                        </div>
                        <p className="text-sm text-slate-600">{test.name}</p>
                         {test.category && <span className="text-[10px] uppercase tracking-wide text-slate-400">{test.category}</span>}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`text-xs font-semibold uppercase tracking-wider ${
                           test.status === 'completed' ? 'text-emerald-600' : 
                           test.status === 'processing' ? 'text-blue-600' : 'text-amber-600'
                        }`}>
                          {test.status}
                        </span>
                        {test.status === 'completed' && <p className="text-xs text-slate-400">Result Available</p>}
                      </div>
                      
                      {/* Action Icons */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                         <button className="p-1 hover:bg-slate-100 rounded text-slate-500"><MoreHorizontal className="w-4 h-4"/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- MODAL INTEGRATION --- */}
      {isTestModalOpen && selectedSample && (
          <TestAssignmentModal 
              isOpen={isTestModalOpen} 
              onClose={() => setIsTestModalOpen(false)}
              sampleId={selectedSample.sampleId}
              existingTests={selectedSample.tests}
              onSave={handleAddTests}
          />
      )}

    </div>
  );
};

// --- Subcomponents ---

const DetailItem = ({ label, value, icon, highlight = false, isBadge = false, badgeColor = '' }: any) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
      {icon} {label}
    </span>
    {isBadge ? (
      <span className={`self-start px-2 py-0.5 rounded text-sm font-medium border ${badgeColor}`}>
        {value}
      </span>
    ) : (
      <span className={`text-sm ${highlight ? 'font-bold text-indigo-700 text-base' : 'text-slate-700'}`}>
        {value}
      </span>
    )}
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="h-full flex flex-col items-center justify-center text-slate-300">
    <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
    <p className="text-sm">{message}</p>
  </div>
);

// --- NEW MODULE: Test Assignment Modal Component ---
const TestAssignmentModal = ({ isOpen, onClose, sampleId, existingTests, onSave }: any) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTests, setSelectedTests] = useState<any[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('All');

    // Get unique categories
    const categories = ['All', ...Array.from(new Set(TEST_CATALOG.map(t => t.category)))];

    // Filter tests
    const availableTests = TEST_CATALOG.filter(test => {
        const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              test.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'All' || test.category === activeCategory;
        const isNotAssigned = !existingTests.some((et: any) => et.code === test.code); // Exclude already assigned
        return matchesSearch && matchesCategory && isNotAssigned;
    });

    const toggleTestSelection = (test: any) => {
        if (selectedTests.find(t => t.code === test.code)) {
            setSelectedTests(prev => prev.filter(t => t.code !== test.code));
        } else {
            setSelectedTests(prev => [...prev, test]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden border border-slate-200">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Assign Tests</h2>
                        <p className="text-sm text-slate-500">Select tests to add to Sample <span className="font-mono font-medium text-indigo-600">{sampleId}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - Split View */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* Left: Filter & List */}
                    <div className="w-2/3 flex flex-col border-r border-slate-200">
                        {/* Search & Tabs */}
                        <div className="p-4 border-b border-slate-200 space-y-4">
                            <div className="relative">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search test code or name..." 
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {categories.map(cat => (
                                    <button 
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                                            activeCategory === cat 
                                            ? 'bg-indigo-600 text-white shadow-sm' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                                {availableTests.map(test => {
                                    const isSelected = selectedTests.some(t => t.code === test.code);
                                    return (
                                        <div 
                                            key={test.code}
                                            onClick={() => toggleTestSelection(test)}
                                            className={`
                                                p-3 rounded-lg border cursor-pointer transition-all duration-200 flex items-start justify-between group
                                                ${isSelected 
                                                    ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-1 ring-indigo-500' 
                                                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                                                }
                                            `}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-md ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {test.category === 'Hematology' ? <Dna className="w-5 h-5" /> : 
                                                     test.category === 'Biochemistry' ? <FlaskConical className="w-5 h-5" /> : 
                                                     <Activity className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{test.code}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 line-clamp-1" title={test.name}>{test.name}</p>
                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">{test.category}</span>
                                                </div>
                                            </div>
                                            <div className={`
                                                w-5 h-5 rounded-full border flex items-center justify-center transition-colors
                                                ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}
                                            `}>
                                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                        </div>
                                    );
                                })}
                                {availableTests.length === 0 && (
                                    <div className="col-span-2 py-10 text-center text-slate-400 flex flex-col items-center">
                                        <Filter className="w-8 h-8 mb-2 opacity-50" />
                                        <p>No tests found matching your criteria</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Selected Summary */}
                    <div className="w-1/3 flex flex-col bg-slate-50">
                        <div className="p-4 border-b border-slate-200 bg-white shadow-sm z-10">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Selected Tests
                                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full ml-auto">
                                    {selectedTests.length}
                                </span>
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {selectedTests.length === 0 ? (
                                <div className="text-center text-slate-400 mt-10 text-sm italic">
                                    Click on tests from the left panel to select them.
                                </div>
                            ) : (
                                selectedTests.map(test => (
                                    <div key={test.code} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center animate-in slide-in-from-left-5 duration-200">
                                        <div>
                                            <span className="font-bold text-slate-700 text-sm block">{test.code}</span>
                                            <span className="text-xs text-slate-500 block truncate max-w-[150px]">{test.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => toggleTestSelection(test)}
                                            className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-200 bg-white">
                             <div className="flex justify-between items-end mb-4 text-sm">
                                 <span className="text-slate-500">Total Estimated Cost:</span>
                                 <span className="font-bold text-slate-800 text-lg">
                                     {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(selectedTests.reduce((acc, t) => acc + t.price, 0))}
                                 </span>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => onSave(selectedTests)}
                        disabled={selectedTests.length === 0}
                        className={`
                            px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2
                            ${selectedTests.length === 0 ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'}
                        `}
                    >
                        <Plus className="w-4 h-4" />
                        Assign {selectedTests.length > 0 ? `${selectedTests.length} Tests` : 'Tests'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LimsSampleLayout;