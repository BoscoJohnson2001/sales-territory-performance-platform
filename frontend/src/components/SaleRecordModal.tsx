import { useState, useRef, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import client from '../api/client';
import {
    HiX, HiSave, HiExclamationCircle,
} from 'react-icons/hi';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Product { id: string; name: string; }
export interface Territory { id: string; name: string; }

interface SaleRecordModalProps {
    products: Product[];
    territories: Territory[];
    initialTerritoryId?: string;
    onClose: () => void;
    onSuccess: () => void;
}

const emptyForm = {
    productId: '', territoryId: '', revenue: '', deals: '',
    quantity: '', saleDate: '', month: '', year: '',
    customerName: '', customerIndustry: '', customerContact: '',
};

export default function SaleRecordModal({
    products,
    territories,
    initialTerritoryId,
    onClose,
    onSuccess
}: SaleRecordModalProps) {
    const [form, setForm] = useState({
        ...emptyForm,
        territoryId: initialTerritoryId || '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const overlayRef = useRef<HTMLDivElement>(null);

    // Close on overlay click
    const handleOverlay = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
    };

    const f = (key: keyof typeof emptyForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
            setForm(prev => ({ ...prev, [key]: e.target.value }));

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await client.post('/api/sales', {
                ...form,
                month: parseInt(form.month),
                year: parseInt(form.year),
            });
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create sale. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div
            ref={overlayRef}
            onClick={handleOverlay}
            className="fixed inset-0 z-[2000] flex justify-end overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        >
            <div className="w-full max-w-xl h-full border-l border-white/10 shadow-2xl animate-slide-in-right flex flex-col"
                style={{ background: 'rgba(15,23,42,0.98)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-text-primary font-bold text-base">New Sale Record</h2>
                        <p className="text-text-subtle text-xs mt-0.5">Fill in the details to log a new sale</p>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors">
                        <HiX className="text-xl" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={submit} className="px-6 py-5 flex-1 overflow-y-auto">
                    {error && (
                        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm text-red-400 border border-red-500/30 flex items-center gap-2"
                            style={{ background: 'rgba(239,68,68,0.08)' }}>
                            <HiExclamationCircle className="text-lg flex-shrink-0" /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Product */}
                        <div className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
                            <label className="text-text-muted text-[10px] font-bold uppercase tracking-widest pl-1">Product</label>
                            <select id="modal-product" className="input" value={form.productId} onChange={f('productId')} required>
                                <option value="">Select Product</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        {/* Territory */}
                        <div className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
                            <label className="text-text-muted text-[10px] font-bold uppercase tracking-widest pl-1">Territory</label>
                            <select id="modal-territory" className="input" value={form.territoryId} onChange={f('territoryId')} required>
                                <option value="">Select Territory</option>
                                {territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>

                        {/* Revenue */}
                        <div className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
                            <label className="text-text-muted text-[10px] font-bold uppercase tracking-widest pl-1">Revenue (₹)</label>
                            <input id="modal-revenue" className="input" placeholder="0.00" type="number" step="0.01" min="0"
                                value={form.revenue} onChange={f('revenue')} required />
                        </div>

                        {/* Deals */}
                        <div className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
                            <label className="text-text-muted text-[10px] font-bold uppercase tracking-widest pl-1">Deals Count</label>
                            <input id="modal-deals" className="input" placeholder="0" type="number" min="0"
                                value={form.deals} onChange={f('deals')} required />
                        </div>

                        {/* Quantity */}
                        <div className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
                            <label className="text-text-muted text-[10px] font-bold uppercase tracking-widest pl-1">Total Quantity</label>
                            <input id="modal-quantity" className="input" placeholder="0" type="number" min="0"
                                value={form.quantity} onChange={f('quantity')} required />
                        </div>

                        {/* Date */}
                        <div className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
                            <label className="text-text-muted text-[10px] font-bold uppercase tracking-widest pl-1">Sale Date</label>
                            <input id="modal-date" className="input" type="date"
                                value={form.saleDate}
                                onChange={e => {
                                    const d = new Date(e.target.value);
                                    if (isNaN(d.getTime())) return;
                                    setForm(prev => ({
                                        ...prev, saleDate: e.target.value,
                                        month: String(d.getMonth() + 1),
                                        year: String(d.getFullYear()),
                                    }));
                                }}
                                required />
                        </div>

                        {/* Customer Name */}
                        <div className="flex flex-col gap-1.5 md:col-span-2 focus-within:text-accent transition-colors">
                            <label className="text-text-muted text-[10px] font-bold uppercase tracking-widest pl-1">Customer Name</label>
                            <input id="modal-customer" className="input" placeholder="Hospital or Organization name"
                                value={form.customerName} onChange={f('customerName')} required />
                        </div>

                        {/* Industry */}
                        <div className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
                            <label className="text-text-muted text-[10px] font-bold uppercase tracking-widest pl-1">Customer Industry</label>
                            <input id="modal-industry" className="input" placeholder="e.g. Healthcare, Pharma"
                                value={form.customerIndustry} onChange={f('customerIndustry')} />
                        </div>

                        {/* Contact */}
                        <div className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
                            <label className="text-text-muted text-[10px] font-bold uppercase tracking-widest pl-1">Contact Details</label>
                            <input id="modal-contact" className="input" placeholder="Phone or email"
                                value={form.customerContact} onChange={f('customerContact')} />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 mt-8 pt-5 border-t border-white/10 mb-4">
                        <button type="button" onClick={onClose} className="btn-secondary py-2.5 px-6 text-xs uppercase tracking-widest font-bold">
                            Cancel
                        </button>
                        <button id="modal-submit" type="submit" disabled={submitting} className="btn-primary py-2.5 px-6 text-xs uppercase tracking-widest font-bold flex items-center gap-2 shadow-lg shadow-accent/20">
                            {submitting ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                                    Saving…
                                </span>
                            ) : (
                                <>
                                    <HiSave className="text-base" />
                                    Save Record
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
