import React from 'react';
import { User as UserIcon, Users } from 'lucide-react';
import type { BaptismForm, CertificateForm, FormType, ServiceForm } from '../../../../../library/manage-request';

interface BaptismFormGodparent {
  godparent_name: string;
  relationship: 'godfather' | 'godmother';
}

interface ManageRequestGodparent {
  name: string;
  type: 'godfather' | 'godmother';
}

type Godparent = BaptismFormGodparent | ManageRequestGodparent;

interface RequestFormDetailsProps {
  request: {
    form_type?: FormType | null;
    baptismForm?: BaptismForm;
    serviceForm?: ServiceForm;
    certificateForm?: CertificateForm;
    service?: { service_type?: string } | null;
  };
  formatDateOnly: (dateString: string | undefined) => string;
}

const isBaptismFormGodparent = (gp: Godparent): gp is BaptismFormGodparent =>
  'godparent_name' in gp && 'relationship' in gp;

const isManageRequestGodparent = (gp: Godparent): gp is ManageRequestGodparent =>
  'name' in gp && 'type' in gp;

const RequestFormDetails: React.FC<RequestFormDetailsProps> = ({ request, formatDateOnly }) => {
  const formType = request.form_type;

  if (formType === 'baptism' && request.baptismForm) {
    const form = request.baptismForm;
    const godparents = (form.godparents || []) as Godparent[];

    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-slate-700 border-b border-slate-200 pb-2">Baptism Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">Child&apos;s Full Name</span>
            <p className="font-medium text-slate-800">
              {form.child_first_name} {form.child_middle_name || ''} {form.child_last_name}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Date of Birth</span>
            <p className="font-medium text-slate-800">{formatDateOnly(form.child_birth_date)}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Place of Birth</span>
            <p className="font-medium text-slate-800">{form.child_birth_place || 'N/A'}</p>
          </div>
          <div>
            <span className="text-slate-500">Mother</span>
            <p className="font-medium text-slate-800">
              {form.mother_first_name} {form.mother_middle_name || ''} {form.mother_last_name}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Father</span>
            <p className="font-medium text-slate-800">
              {form.father_first_name} {form.father_middle_name || ''} {form.father_last_name}
            </p>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Address</span>
            <p className="font-medium text-slate-800">{form.address}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Contact</span>
            <p className="font-medium text-slate-800">{form.contact_number}</p>
          </div>
          {godparents.length > 0 && (
            <div className="md:col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
              <span className="text-slate-700 font-medium block mb-2 flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                Godparents ({godparents.length})
              </span>
              <div className="space-y-1.5">
                {godparents.map((gp, idx) => {
                  let name = '';
                  let relationship = '';

                  if (isBaptismFormGodparent(gp)) {
                    name = gp.godparent_name;
                    relationship = gp.relationship;
                  } else if (isManageRequestGodparent(gp)) {
                    name = gp.name;
                    relationship = gp.type;
                  }

                  const isGodfather = relationship === 'godfather';

                  return (
                    <div key={idx} className="flex items-center gap-2 p-1.5 bg-white rounded-md shadow-sm">
                      <span
                        className={`flex-shrink-0 p-1 rounded-full ${
                          isGodfather ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <UserIcon size={14} />
                      </span>
                      <span className="font-medium text-slate-800">{name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                          isGodfather ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                        }`}
                      >
                        {isGodfather ? 'Godfather' : 'Godmother'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (formType === 'service' && request.serviceForm) {
    const form = request.serviceForm;

    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-slate-700 border-b border-slate-200 pb-2">Service Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">Service Name</span>
            <p className="font-medium text-slate-800">{form.service_name || request.service?.service_type || 'N/A'}</p>
          </div>
          <div>
            <span className="text-slate-500">Full Name</span>
            <p className="font-medium text-slate-800">{form.full_name}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Address</span>
            <p className="font-medium text-slate-800">{form.address}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Contact</span>
            <p className="font-medium text-slate-800">{form.contact_number}</p>
          </div>
        </div>
      </div>
    );
  }

  if (formType === 'certificate' && request.certificateForm) {
    const form = request.certificateForm;

    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-slate-700 border-b border-slate-200 pb-2">Certificate Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">Certificate Type</span>
            <p className="font-medium text-slate-800">
              {form.certificate_type_label || form.certificate_type || 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Full Name</span>
            <p className="font-medium text-slate-800">{form.full_name}</p>
          </div>
          <div>
            <span className="text-slate-500">Birth Date</span>
            <p className="font-medium text-slate-800">
              {form.birth_date ? formatDateOnly(form.birth_date) : 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Marriage Date</span>
            <p className="font-medium text-slate-800">
              {form.marriage_date ? formatDateOnly(form.marriage_date) : 'N/A'}
            </p>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Address</span>
            <p className="font-medium text-slate-800">{form.address}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Contact</span>
            <p className="font-medium text-slate-800">{form.contact_number}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg">
      No additional form details available for this request.
    </div>
  );
};

export default RequestFormDetails;
