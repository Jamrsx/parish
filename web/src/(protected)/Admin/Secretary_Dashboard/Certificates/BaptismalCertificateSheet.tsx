import React from 'react';
import '@fontsource/great-vibes/400.css';
import type { BaptismalCertificateDetails } from '../../../../../library/certificates';
import { formatDayOfMonth, formatIssuedDate } from './certificateFormat';

export const SHEET_WIDTH_IN = 8.5;
export const SHEET_HEIGHT_IN = 11;

const blank = (value: string | null | undefined, width = '1.1in') =>
  value && value.trim() ? (
    value.toUpperCase()
  ) : (
    <span style={{ display: 'inline-block', width, borderBottom: '1px solid #444' }}>&nbsp;</span>
  );

const plain = (value: string | null | undefined, width = '0.5in') =>
  value && value.trim() ? (
    value
  ) : (
    <span style={{ display: 'inline-block', width, borderBottom: '1px solid #444' }}>&nbsp;</span>
  );

const sponsorLines = (sponsors: string[]): [string, string | null] | null => {
  const names = sponsors.map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (names.length === 0) return null;
  if (names.length === 1) return [names[0], null];
  return [names.slice(0, -1).join(', '), names[names.length - 1]];
};

const ministerLine = (name: string): string => {
  const clean = name.trim().toUpperCase();
  return clean.startsWith('REV') ? `By the ${clean}` : `By the Rev. ${clean}`;
};

const BaptismalCertificateSheet: React.FC<{ data: BaptismalCertificateDetails }> = ({ data }) => {
  const sponsors = sponsorLines(data.sponsors || []);

  const labelCell: React.CSSProperties = { padding: '1pt 10pt 1pt 0', whiteSpace: 'nowrap', verticalAlign: 'top' };
  const valueCell: React.CSSProperties = { padding: '1pt 0', verticalAlign: 'top' };

  return (
    <div
      style={{
        width: `${SHEET_WIDTH_IN}in`,
        height: `${SHEET_HEIGHT_IN}in`,
        background: '#fff',
        color: '#111',
        fontFamily: '"Times New Roman", Times, serif',
        boxSizing: 'border-box',
        padding: '0.45in',
      }}
    >
      <div
        style={{
          border: '1.2px solid #222',
          height: '100%',
          boxSizing: 'border-box',
          padding: '0.45in 0.55in 0.35in',
          display: 'flex',
          flexDirection: 'column',
          fontSize: '12.5pt',
          lineHeight: 1.45,
        }}
      >
        <div style={{ textAlign: 'center', fontSize: '12pt', lineHeight: 1.35 }}>
          <div>Archdiocese of Cagayan de Oro</div>
          <div style={{ fontWeight: 700 }}>San Guillermo Parish</div>
          <div>Iponan , Cagayan De Oro City</div>
        </div>

        <div
          style={{
            textAlign: 'center',
            fontFamily: '"Great Vibes", "Brush Script MT", cursive',
            fontSize: '40pt',
            lineHeight: 1.1,
            margin: '0.45in 0 0.3in',
          }}
        >
          Baptismal Certificate
        </div>

        <div style={{ textAlign: 'center' }}>This is to certify that</div>
        <div
          style={{
            textAlign: 'center',
            fontWeight: 700,
            textDecoration: 'underline',
            fontSize: '14pt',
            margin: '4pt 0 12pt',
            letterSpacing: '0.3pt',
          }}
        >
          {blank(data.person_name, '3in')}
        </div>

        <table style={{ margin: '0 auto 0 1.4in', borderCollapse: 'collapse', fontSize: '12.5pt' }}>
          <tbody>
            <tr>
              <td style={labelCell}>Name of Father:</td>
              <td style={valueCell}>{blank(data.father_name, '2.4in')}</td>
            </tr>
            <tr>
              <td style={labelCell}>Name of Mother:</td>
              <td style={valueCell}>{blank(data.mother_name, '2.4in')}</td>
            </tr>
            <tr>
              <td style={labelCell}>Place of Birth:</td>
              <td style={valueCell}>{blank(data.birth_place, '2.4in')}</td>
            </tr>
            <tr>
              <td style={labelCell}>Date of Birth:</td>
              <td style={valueCell}>{formatDayOfMonth(data.birth_date) || blank(null, '2.4in')}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: 'center', marginTop: '16pt' }}>has received the</div>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '19pt', margin: '4pt 0 6pt', letterSpacing: '0.4pt' }}>
          HOLY SACRAMENT OF BAPTISM
        </div>
        <div style={{ textAlign: 'center' }}>according to the rite of the Roman Catholic Church</div>
        <div style={{ textAlign: 'center' }}>on the {formatDayOfMonth(data.baptism_date) || blank(null, '2in')}</div>
        <div style={{ textAlign: 'center' }}>
          {data.minister_name?.trim() ? ministerLine(data.minister_name) : <>By the Rev. {blank(null, '2.4in')}</>}
        </div>
        {sponsors && (
          <>
            <div style={{ textAlign: 'center' }}>The sponsors being {sponsors[0]}</div>
            {sponsors[1] && <div style={{ textAlign: 'center' }}>and {sponsors[1]}</div>}
          </>
        )}
        <div style={{ textAlign: 'center', marginTop: '2pt' }}>
          As appears on the Baptismal Register No. {plain(data.register_no)} Page {plain(data.register_page)} Line{' '}
          {plain(data.register_line)} of this church.
        </div>

        <div style={{ textAlign: 'center', marginTop: '20pt' }}>Purpose: {plain(data.purpose, '1.4in')}</div>

        <div style={{ textAlign: 'center', marginTop: '0.55in' }}>
          <div style={{ fontWeight: 700, fontSize: '13pt' }}>{blank(data.signatory_name, '3in')}</div>
          <div>Parish Priest</div>
        </div>

        <div style={{ marginTop: 'auto', fontSize: '10.5pt', lineHeight: 1.3 }}>
          <div style={{ marginLeft: '0.5in', marginBottom: '0.3in' }}>SEAL</div>
          <div>Date Issued: {formatIssuedDate(data.date_issued)}</div>
        </div>
      </div>
    </div>
  );
};

export default BaptismalCertificateSheet;
