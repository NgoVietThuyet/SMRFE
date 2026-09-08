import { useState } from 'react';
import {
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { transcriptSegments } from '@/data';
import { PanelHeader } from '@/components/meeting/PanelHeader';

interface AIPanelProps {
  onClose: () => void;
}

export function AIPanel({ onClose }: AIPanelProps) {
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'actions'>('transcript');

  return (
    <>
      <PanelHeader title="AI Assistant" icon={Sparkles} onClose={onClose} />
      <div className="px-4 py-3 bg-gradient-to-br from-accent-50 to-primary-50 border-b border-ink-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-accent-500 to-primary-600 rounded-lg flex items-center justify-center text-white">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">AI Live Transcription</p>
            <p className="text-xs text-ink-500">Real-time speech-to-text · {transcriptSegments.length} segments</p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-ink-100">
        {(['transcript', 'summary', 'actions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${activeTab === t ? 'text-accent-600 border-b-2 border-accent-600' : 'text-ink-400 hover:text-ink-600'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'transcript' && (
          <div className="px-4 py-3 space-y-3">
            {transcriptSegments.map((seg) => (
              <div key={seg.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-ink-700">{seg.speakerName}</span>
                  <span className="text-[10px] text-ink-400 font-mono">{seg.startTime}</span>
                  {seg.isDraft && <span className="badge bg-warning-100 text-warning-700 text-[10px]">Draft</span>}
                </div>
                <p className="text-sm text-ink-600 leading-relaxed pl-3 border-l-2 border-ink-200">{seg.text}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="px-4 py-3 space-y-4">
            <div className="p-3 rounded-lg bg-accent-50 border border-accent-100">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-accent-600" />
                <p className="text-xs font-semibold text-accent-700">Auto-Generated Summary (Draft)</p>
              </div>
              <p className="text-sm text-ink-700 leading-relaxed">
                The meeting reviewed Q3 financial performance with revenue at 18.5B VND, 12% above target. Key variance:
                marketing 8% under budget, IT 5% over due to cloud migration. Next steps include Q4 budget preparation and
                cloud migration review.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Key Decisions</p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-sm text-ink-600">
                  <CheckCircle2 size={14} className="text-success-600 mt-0.5 shrink-0" /> Q3 revenue target exceeded by 12%
                </li>
                <li className="flex items-start gap-2 text-sm text-ink-600">
                  <CheckCircle2 size={14} className="text-success-600 mt-0.5 shrink-0" /> Marketing budget underspent by 8%
                </li>
                <li className="flex items-start gap-2 text-sm text-ink-600">
                  <AlertCircle size={14} className="text-warning-600 mt-0.5 shrink-0" /> IT cloud migration overspent by 5%
                </li>
              </ul>
            </div>
            <button className="btn-secondary w-full text-xs py-2">
              <FileText size={14} /> Generate Full MOM (DOCX)
            </button>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="px-4 py-3 space-y-2">
            {[
              { title: 'Prepare Q4 budget proposal', assignee: 'Le Minh Cuong', deadline: '3 days', priority: 'high' },
              { title: 'Update marketing timeline', assignee: 'Pham Thi Dung', deadline: '5 days', priority: 'medium' },
              { title: 'Schedule cloud migration review', assignee: 'Hoang Van Em', deadline: '2 days', priority: 'high' },
            ].map((action, i) => (
              <div key={i} className="p-3 rounded-lg border border-ink-100 hover:border-primary-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-ink-900">{action.title}</p>
                  <span className={`badge ${action.priority === 'high' ? 'bg-error-100 text-error-700' : 'bg-warning-100 text-warning-700'} text-[10px] shrink-0`}>
                    {action.priority}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-ink-400">
                  <span>→ {action.assignee}</span>
                  <span>· {action.deadline}</span>
                </div>
              </div>
            ))}
            <button className="btn-primary w-full text-xs py-2 mt-2">
              <CheckCircle2 size={14} /> Send to Secretary for Approval
            </button>
          </div>
        )}
      </div>
    </>
  );
}
