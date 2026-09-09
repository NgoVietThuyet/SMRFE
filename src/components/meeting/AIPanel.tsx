import { useState } from 'react';
import {
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { transcriptSegments } from '@/data';
import { PanelHeader } from '@/components/meeting/PanelHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useLanguage } from '@/i18n';

interface AIPanelProps {
  onClose: () => void;
}

export function AIPanel({ onClose }: AIPanelProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'actions'>('transcript');

  return (
    <>
      <PanelHeader title={t('panel.ai.title')} icon={Sparkles} onClose={onClose} />
      <div className="px-4 py-3 bg-gradient-to-br from-accent-50 to-primary-50 border-b border-ink-100">
        <div className="flex items-center gap-2.5">
          <div aria-hidden="true" className="w-8 h-8 bg-gradient-to-br from-accent-500 to-primary-600 rounded-lg flex items-center justify-center text-white shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">{t('panel.ai.live')}</p>
            <p aria-live="polite" className="text-xs text-ink-500 tnum">{t('panel.ai.segments', { n: transcriptSegments.length })}</p>
          </div>
        </div>
      </div>

      <div role="tablist" aria-label={t('panel.ai.views')} className="flex border-b border-ink-100">
        {(['transcript', 'summary', 'actions'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 min-h-[40px] text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-cta-500/40 ${activeTab === tab ? 'text-cta-800 border-b-2 border-accent-600' : 'text-ink-500 hover:text-ink-600'}`}
          >
            {t(`panel.ai.${tab}` as 'panel.ai.transcript' | 'panel.ai.summary' | 'panel.ai.actions')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'transcript' && (
          <div role="log" aria-live="polite" aria-label={t('panel.ai.log')} className="px-4 py-3 space-y-3">
            {transcriptSegments.map((seg) => (
              <div key={seg.id} className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-ink-700">{seg.speakerName}</span>
                  <span className="text-[10px] text-ink-500 font-mono tnum">{seg.startTime}</span>
                  {seg.isDraft && <Badge tone="warning">{t('panel.ai.draft')}</Badge>}
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
                <FileText size={14} aria-hidden="true" className="text-accent-700" />
                <p className="text-xs font-semibold text-accent-800">{t('panel.ai.summaryTitle')}</p>
              </div>
              <p className="text-sm text-ink-700 leading-relaxed">
                The meeting reviewed Q3 financial performance with revenue at 18.5B VND, 12% above target. Key variance:
                marketing 8% under budget, IT 5% over due to cloud migration. Next steps include Q4 budget preparation and
                cloud migration review.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">{t('panel.ai.keyDecisions')}</p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-sm text-ink-600">
                  <CheckCircle2 size={14} aria-hidden="true" className="text-success-600 mt-0.5 shrink-0" /> Q3 revenue target exceeded by 12%
                </li>
                <li className="flex items-start gap-2 text-sm text-ink-600">
                  <CheckCircle2 size={14} aria-hidden="true" className="text-success-600 mt-0.5 shrink-0" /> Marketing budget underspent by 8%
                </li>
                <li className="flex items-start gap-2 text-sm text-ink-600">
                  <AlertCircle size={14} aria-hidden="true" className="text-warning-700 mt-0.5 shrink-0" /> IT cloud migration overspent by 5%
                </li>
              </ul>
            </div>
            <Button variant="secondary" size="sm" className="w-full">
              <FileText size={14} aria-hidden="true" /> {t('panel.ai.genMom')}
            </Button>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="px-4 py-3 space-y-2">
            <ul className="space-y-2">
            {[
              { title: 'Prepare Q4 budget proposal', assignee: 'Le Minh Cuong', deadline: '3 days', priority: 'high' },
              { title: 'Update marketing timeline', assignee: 'Pham Thi Dung', deadline: '5 days', priority: 'medium' },
              { title: 'Schedule cloud migration review', assignee: 'Hoang Van Em', deadline: '2 days', priority: 'high' },
            ].map((action, i) => (
              <li key={i} className="p-3 rounded-lg border border-ink-100 hover:border-primary-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-ink-900">{action.title}</p>
                  <Badge tone={action.priority === 'high' ? 'error' : 'warning'}>{action.priority}</Badge>
                </div>
                <p className="mt-2 text-xs text-ink-500">→ {action.assignee} · {action.deadline}</p>
              </li>
            ))}
            </ul>
            <Button size="sm" className="w-full mt-2">
              <CheckCircle2 size={14} aria-hidden="true" /> {t('panel.ai.sendSecretary')}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
