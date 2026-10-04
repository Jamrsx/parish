import React, { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Award, FilePlus2, History } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import AlertModal from '../Inventory/Modals/AlertModal';
import {
  reprintsAPI,
  type BaptismalCertificateDetails,
  type IssuedCertificateRow,
  type ReprintFeeSetting,
  type ReprintStatusCounts,
} from '../../../../../library/certificates';
import CertificatePrintPortal from './CertificatePrintPortal';
import GenerateCertificate from './GenerateCertificate';
import IssuedCertificates from './IssuedCertificates';
import ReprintFeeCard from './ReprintFeeCard';
import ReprintRequestModal from './ReprintRequestModal';
import ReprintRequests from './ReprintRequests';

type PageTab = 'generate' | 'issued';

const Certificates: React.FC = () => {
  const [pageTab, setPageTab] = useState<PageTab>('generate');
  const [printData, setPrintData] = useState<BaptismalCertificateDetails | null>(null);
  const [historyToken, setHistoryToken] = useState(0);
  const [reprintToken, setReprintToken] = useState(0);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [fee, setFee] = useState<ReprintFeeSetting | null>(null);
  const [readyCount, setReadyCount] = useState(0);
  const [reprintTarget, setReprintTarget] = useState<IssuedCertificateRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadReprintInfo = async () => {
      try {
        const [feeRes, listRes] = await Promise.all([reprintsAPI.getFee(), reprintsAPI.list({ status: 'paid', per_page: 1 })]);
        console.log('[Certificates] Reprint fee / counts', feeRes.data, listRes.data.counts);
        if (cancelled) return;
        if (feeRes.data?.success && feeRes.data.data) setFee(feeRes.data.data);
        if (listRes.data?.counts) setReadyCount(listRes.data.counts.paid);
      } catch (err) {
        console.error('[Certificates] Could not load reprint fee', err);
      }
    };
    loadReprintInfo();
    return () => {
      cancelled = true;
    };
  }, []);

  const printCertificate = useCallback((details: BaptismalCertificateDetails) => {
    console.log('[Certificates] Printing certificate', details);
    flushSync(() => setPrintData(details));
    const fontReady = document.fonts?.load ? document.fonts.load('40px "Great Vibes"') : Promise.resolve();
    fontReady
      .catch((err) => console.warn('[Certificates] Script font not ready, printing anyway', err))
      .finally(() => window.print());
  }, []);

  const showAlert = useCallback((type: 'success' | 'error', message: string) => setAlert({ type, message }), []);
  const refreshHistory = useCallback(() => setHistoryToken((t) => t + 1), []);
  const handleCounts = useCallback((counts: ReprintStatusCounts) => setReadyCount(counts.paid), []);

  return (
    <div>
      <PageHeader
        title="Certificates"
        description="Generate, print and keep a record of Baptismal Certificates."
        icon={Award}
      />

      <div className="mb-6 inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Certificates sections">
        {([
          { id: 'generate', label: 'Generate Certificate', icon: FilePlus2 },
          { id: 'issued', label: 'Issued & Reprints', icon: History },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pageTab === id}
            onClick={() => setPageTab(id)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              pageTab === id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon size={16} aria-hidden /> {label}
            {id === 'issued' && readyCount > 0 && (
              <span
                className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold leading-4 text-white"
                title={`${readyCount} paid reprint${readyCount === 1 ? '' : 's'} ready to release`}
              >
                {readyCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div hidden={pageTab !== 'generate'}>
        <GenerateCertificate onPrint={printCertificate} onAlert={showAlert} onIssued={refreshHistory} />
      </div>
      {pageTab === 'issued' && (
        <div className="space-y-6">
          <ReprintFeeCard fee={fee} onSaved={setFee} onAlert={showAlert} />
          <ReprintRequests
            onPrint={printCertificate}
            onAlert={showAlert}
            onCountsChange={handleCounts}
            refreshToken={reprintToken}
          />
          <IssuedCertificates onReprint={setReprintTarget} refreshToken={historyToken} />
        </div>
      )}

      {reprintTarget && (
        <ReprintRequestModal
          certificate={reprintTarget}
          fee={fee}
          onClose={() => setReprintTarget(null)}
          onRequested={(reprint, message) => {
            console.log('[Certificates] Reprint requested', reprint);
            setReprintTarget(null);
            setReprintToken((t) => t + 1);
            showAlert('success', message);
          }}
        />
      )}

      <CertificatePrintPortal data={printData} />

      <AlertModal
        isOpen={!!alert}
        type={alert?.type || 'error'}
        message={alert?.message || ''}
        onClose={() => setAlert(null)}
      />
    </div>
  );
};

export default Certificates;
