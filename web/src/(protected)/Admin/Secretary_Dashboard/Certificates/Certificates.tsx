import React, { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import { Award, FilePlus2, History } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import AlertModal from '../Inventory/Modals/AlertModal';
import type { BaptismalCertificateDetails } from '../../../../../library/certificates';
import CertificatePrintPortal from './CertificatePrintPortal';
import GenerateCertificate from './GenerateCertificate';
import IssuedCertificates from './IssuedCertificates';

type PageTab = 'generate' | 'issued';

const Certificates: React.FC = () => {
  const [pageTab, setPageTab] = useState<PageTab>('generate');
  const [printData, setPrintData] = useState<BaptismalCertificateDetails | null>(null);
  const [historyToken, setHistoryToken] = useState(0);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
          { id: 'issued', label: 'Issued Certificates', icon: History },
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
          </button>
        ))}
      </div>

      <div hidden={pageTab !== 'generate'}>
        <GenerateCertificate onPrint={printCertificate} onAlert={showAlert} onIssued={refreshHistory} />
      </div>
      {pageTab === 'issued' && <IssuedCertificates onReprint={printCertificate} refreshToken={historyToken} />}

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
