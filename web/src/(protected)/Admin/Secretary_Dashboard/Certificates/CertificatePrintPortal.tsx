import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BaptismalCertificateDetails } from '../../../../../library/certificates';
import BaptismalCertificateSheet from './BaptismalCertificateSheet';

const PRINT_ROOT_ID = 'certificate-print-root';

const PRINT_CSS = `
#${PRINT_ROOT_ID} { display: none; }
@media print {
  @page { size: 8.5in 11in; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
  #${PRINT_ROOT_ID} { display: block !important; }
  #${PRINT_ROOT_ID} * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

/** Renders the certificate as a direct child of <body> so print CSS can hide the rest of the app. */
const CertificatePrintPortal: React.FC<{ data: BaptismalCertificateDetails | null }> = ({ data }) => {
  const [root] = useState(() => {
    const el = document.createElement('div');
    el.id = PRINT_ROOT_ID;
    return el;
  });

  useEffect(() => {
    document.body.appendChild(root);
    return () => {
      root.remove();
    };
  }, [root]);

  return createPortal(
    <>
      <style>{PRINT_CSS}</style>
      {data && <BaptismalCertificateSheet data={data} />}
    </>,
    root,
  );
};

export default CertificatePrintPortal;
