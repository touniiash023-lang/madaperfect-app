import React, { useEffect, useState } from "react";
import Login from './Login';
import { app, auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import { FiLogOut } from 'react-icons/fi';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'superadmin' or 'commercial'
  const [view, setView] = useState('dashboard');

  // Firestore state
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // local forms
  const [productForm, setProductForm] = useState({ id:null, name:'', price:'', description:'', link:'', image:'' });
  const [clientForm, setClientForm] = useState({ id:null, name:'', email:'', phone:'', address:'' });
  const [invoiceDraft, setInvoiceDraft] = useState({ id:null, clientId:null, items:[], type:'commercial', date:new Date().toISOString().slice(0,10), deliveryDate:'', deliveryAddress:'', paid:0, number:'' });
  const [editingInvoice, setEditingInvoice] = useState(false);

  // Auth listener => get role via getIdTokenResult
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async(u)=>{
      if(!u){ setUser(null); setRole(null); return; }
      setUser(u);
      const idTokenResult = await u.getIdTokenResult(true);
      const r = idTokenResult.claims.role || idTokenResult.claims['custom:role'] || null;
      setRole(r);
      // load Firestore data after role known
      loadAll();
    });
    return () => unsub();
  }, []);

  async function loadAll() {
    await loadProducts();
    await loadClients();
    await loadInvoices();
  }

  async function loadProducts() {
    const q = await getDocs(collection(db, 'products'));
    setProducts(q.docs.map(d=>({ id:d.id, ...d.data() })));
  }

  async function loadClients() {
    const q = await getDocs(collection(db, 'clients'));
    setClients(q.docs.map(d=>({ id:d.id, ...d.data() })));
  }

  async function loadInvoices() {
    const q = await getDocs(collection(db, 'invoices'));
    setInvoices(q.docs.map(d=>({ id:d.id, ...d.data() })));
  }

  // ROLE helpers
  const isAdmin = () => role === 'superadmin';
  const isCommercial = () => role === 'commercial';

  // Product CRUD (admin-only for create/update/delete)
  async function saveProductFirestore() {
    if(!productForm.name) return alert('Nom requis');
    if(!isAdmin()) return alert('Action non autorisée (seulement superadmin)');
    const payload = { ...productForm };
    if(productForm.id){ await updateDoc(doc(db,'products',productForm.id), payload); }
    else { const ref = await addDoc(collection(db,'products'), payload); await updateDoc(ref, { id: ref.id }); }
    setProductForm({ id:null, name:'', price:'', description:'', link:'', image:'' });
    loadProducts();
  }

  async function deleteProductFirestore(id) {
    if(!isAdmin()) return alert('Action non autorisée');
    if(!confirm('Supprimer cet article ?')) return;
    await deleteDoc(doc(db,'products',id));
    loadProducts();
  }

  // Clients CRUD (admin-only)
  async function saveClientFirestore() {
    if(!clientForm.name) return alert('Nom requis');
    if(!isAdmin()) return alert('Action non autorisée');
    const payload = { ...clientForm };
    if(clientForm.id){ await updateDoc(doc(db,'clients',clientForm.id), payload); }
    else { const ref = await addDoc(collection(db,'clients'), payload); await updateDoc(ref, { id: ref.id }); }
    setClientForm({ id:null, name:'', email:'', phone:'', address:'' });
    loadClients();
  }

  async function deleteClientFirestore(id) {
    if(!isAdmin()) return alert('Action non autorisée');
    if(!confirm('Supprimer ce client ?')) return;
    await deleteDoc(doc(db,'clients',id));
    loadClients();
  }

  // Invoices: create only admin, update only admin, commercial can only read & PDF
  async function saveInvoiceFirestore() {
    if(!invoiceDraft.clientId) return alert('Sélectionner un client');
    if(!isAdmin()) return alert('Action non autorisée');
    const invToSave = { ...invoiceDraft, number: invoiceDraft.number || `INV-${Date.now()}` };
    const ref = await addDoc(collection(db,'invoices'), invToSave);
    await updateDoc(ref, { id: ref.id });
    resetInvoiceDraft();
    loadInvoices();
  }

  function startEditInvoice(inv) {
    if(!isAdmin()) return alert('Action non autorisée');
    setInvoiceDraft({ ...inv });
    setEditingInvoice(true);
    setView('invoices');
  }

  async function updateInvoiceFirestore() {
    if(!invoiceDraft.id) return alert('Invoice id manquant');
    if(!isAdmin()) return alert('Action non autorisée');
    await updateDoc(doc(db,'invoices',invoiceDraft.id), { ...invoiceDraft });
    alert('Facture mise à jour !');
    setEditingInvoice(false);
    resetInvoiceDraft();
    loadInvoices();
  }

  async function deleteInvoiceFirestore(id) {
    if(!isAdmin()) return alert('Action non autorisée');
    if(!confirm('Supprimer cette facture ?')) return;
    await deleteDoc(doc(db,'invoices',id));
    loadInvoices();
  }

  async function editInvoicePayment(inv) {
    if(!isAdmin()) return alert('Action non autorisée');
    const nouveauPaiement = Number(prompt('Montant payé par le client (en Ariary) :', inv.paid || 0));
    if(isNaN(nouveauPaiement)) return alert('Montant invalide');
    await updateDoc(doc(db,'invoices',inv.id), { paid: nouveauPaiement });
    loadInvoices();
    alert('Paiement mis à jour !');
  }

  function resetInvoiceDraft() { setInvoiceDraft({ id:null, clientId:null, items:[], type:'commercial', date:new Date().toISOString().slice(0,10), deliveryDate:'', deliveryAddress:'', paid:0, number:'' }); }

  // PDF generation (any role)
  function parsePrice(value) { if(!value) return 0; return Number(String(value).replace(/\\D/g,'')) || 0; }
  function formatMG(n) { return Number(n || 0).toLocaleString('fr-FR') + ' MGA'; }
  function numberToWordsMG(num) { return String(num); /* simplified for brevity */ }

  function generateInvoicePDF(inv) {
    const doc = new jsPDF({ unit:'pt', format:'a4' });
    let y = 40; const margin = 20;
    const client = clients.find(c=>c.id === inv.clientId) || {};
    const total = inv.items.reduce((a,b)=>a + (b.qty||0)*parsePrice(b.price), 0);
    const paid = inv.paid || 0; const rest = total - paid;
    doc.setFontSize(12); doc.text((companyName() || 'Mada Perfect'), margin, y); y+=16;
    doc.text(inv.type === 'proforma' ? 'FACTURE PROFORMA' : 'FACTURE COMMERCIALE', margin, y); y+=26;
    doc.text(`Date : ${inv.date}`, margin, y); doc.text(`N°: ${inv.number}`, 300, y); y+=20;
    doc.text('D o i t :', margin, y); y+=12; doc.text(client.name || '', margin, y); y+=12;
    doc.text(client.address || '', margin, y); y+=16;
    doc.line(margin, y, 550, y); y+=12;
    doc.text('Quantité', margin, y); doc.text('Désignation', margin+80, y); doc.text('Prix', margin+260, y); doc.text('Montant', margin+400, y); y+=12;
    doc.line(margin, y, 550, y); y+=12;
    inv.items.forEach(it=>{ const montant=(it.qty||0)*parsePrice(it.price); doc.text(String(it.qty), margin, y); doc.text(it.name, margin+80, y); doc.text(formatMG(it.price), margin+260, y); doc.text(formatMG(montant), margin+390, y); y+=14; });
    doc.line(margin, y, 550, y); y+=18;
    doc.text('Total', margin+320, y); doc.text(formatMG(total), margin+390, y); y+=16;
    doc.text('Payé', margin+320, y); doc.text(formatMG(paid), margin+390, y); y+=16;
    doc.text('Reste', margin+320, y); doc.text(formatMG(rest), margin+390, y); y+=26;
    const typeLabel = inv.type === 'proforma' ? 'Proforma' : 'Commerciale';
    doc.text('Arrêtée la présente facture ' + typeLabel + ' à la somme : ' + numberToWordsMG(total) + ' Ariary', margin, y); y+=24;
    doc.text('Merci pour votre confiance.', margin, y);
    doc.save((inv.number||'invoice') + '.pdf');
  }

  function companyName() { try { return JSON.parse(window.localStorage.getItem('mp_company')||'{{\"name\":\"Mada Perfect\"}}').name; } catch(e){ return 'Mada Perfect'; } }

  // Logout
  async function doLogout() { await signOut(auth); setUser(null); setRole(null); }

  // If not logged show Login
  if(!user) return <Login onLogin={() => { /* no-op */ }} />;

  // UI (keeps same visual structure, with buttons disabled/hidden based on role)
  return (
    <div className='min-h-screen bg-gray-100 font-sans'>
      <button onClick={doLogout} className='fixed top-4 right-4 bg-white p-2 rounded shadow' title='Déconnexion'><FiLogOut /></button>
      <div className='flex'>
        <aside className='w-72 bg-indigo-900 text-white min-h-screen p-6'>
          <h1 className='text-2xl font-bold mb-6'>MadaPerfect</h1>
          <nav className='space-y-3'>
            <button onClick={()=> setView('dashboard')} className={`w-full text-left px-3 py-2 rounded ${view==='dashboard'? 'bg-indigo-700': ''}`}>Tableau de bord</button>
            <button onClick={()=> setView('articles')} className={`w-full text-left px-3 py-2 rounded ${view==='articles'? 'bg-indigo-700': ''}`}>Articles</button>
            <button onClick={()=> setView('invoices')} className={`w-full text-left px-3 py-2 rounded ${view==='invoices'? 'bg-indigo-700': ''}`}>Factures</button>
            <button onClick={()=> setView('clients')} className={`w-full text-left px-3 py-2 rounded ${view==='clients'? 'bg-indigo-700': ''}`}>Clients</button>
            <button onClick={()=> setView('settings')} className={`w-full text-left px-3 py-2 rounded ${view==='settings'? 'bg-indigo-700': ''}`}>Paramètres</button>
          </nav>
          <div className='mt-6 text-sm'>Connecté: <strong>{user.email}</strong><br/>Rôle: <strong>{role}</strong></div>
        </aside>

        <main className='flex-1 p-6'>
          {view === 'dashboard' && (
            <div>
              <h2 className='text-xl font-semibold mb-4'>Tableau de bord</h2>
              <div className='grid grid-cols-3 gap-4'>
                <div className='bg-white p-4 rounded shadow'>Produits: {products.length}</div>
                <div className='bg-white p-4 rounded shadow'>Clients: {clients.length}</div>
                <div className='bg-white p-4 rounded shadow'>Factures: {invoices.length}</div>
              </div>
            </div>
          )}

          {view === 'articles' && (
            <div className='grid grid-cols-3 gap-6'>
              <div className='col-span-2 bg-white p-4 rounded shadow'>
                <h3 className='font-semibold mb-4'>Liste des produits</h3>
                <div className='space-y-3'>
                  {products.map(p => (
                    <div key={p.id} className='flex items-center justify-between border rounded p-3'>
                      <div className='flex items-center gap-3'>
                        <img src={p.image || ''} alt='' className='w-14 h-14 object-cover rounded' />
                        <div>
                          <div className='font-semibold'>{p.name}</div>
                          <div className='text-sm'>{p.description}</div>
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='font-semibold'>{formatMG(p.price)}</div>
                        <div className='flex gap-2 mt-2 justify-end'>
                          <button onClick={()=>{ setProductForm(p); }} className='px-3 py-1 bg-yellow-400 rounded text-sm' disabled={!isAdmin()}>Modifier</button>
                          <button onClick={()=> deleteProductFirestore(p.id)} className='px-3 py-1 bg-red-500 rounded text-sm text-white' disabled={!isAdmin()}>Supprimer</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className='bg-white p-4 rounded shadow'>
                <h3 className='font-semibold mb-3'>Ajouter / Modifier produit</h3>
                <input value={productForm.name} onChange={e=>setProductForm(f=>({...f, name:e.target.value}))} placeholder='Nom du produit' className='w-full px-2 py-2 border rounded mb-2' />
                <input value={productForm.price} onChange={e=>setProductForm(f=>({...f, price:e.target.value}))} placeholder='Prix' className='w-full px-2 py-2 border rounded mb-2' />
                <textarea value={productForm.description} onChange={e=>setProductForm(f=>({...f, description:e.target.value}))} placeholder='Description' className='w-full px-2 py-2 border rounded mb-2' />
                <input value={productForm.link} onChange={e=>setProductForm(f=>({...f, link:e.target.value}))} placeholder='Lien' className='w-full px-2 py-2 border rounded mb-2' />
                <div className='flex gap-2'>
                  <button onClick={saveProductFirestore} className='px-3 py-2 bg-indigo-600 text-white rounded' disabled={!isAdmin()}>Enregistrer</button>
                  <button onClick={()=> setProductForm({ id:null, name:'', price:'', description:'', link:'', image:'' })} className='px-3 py-2 border rounded'>Annuler</button>
                </div>
              </div>
            </div>
          )}

          {view === 'clients' && (
            <div className='grid grid-cols-3 gap-6'>
              <div className='col-span-2 bg-white p-4 rounded shadow'>
                <h3 className='font-semibold mb-3'>Liste des clients</h3>
                <table className='w-full text-sm'><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th></th></tr></thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id} className='border-t'><td>{c.name}</td><td>{c.email}</td><td>{c.phone}</td><td>
                        <div className='flex gap-2'>
                          <button onClick={()=>{ setClientForm(c); }} className='px-2 py-1 bg-yellow-400 rounded' disabled={!isAdmin()}>Modifier</button>
                          <button onClick={()=> deleteClientFirestore(c.id)} className='px-2 py-1 bg-red-500 rounded text-white' disabled={!isAdmin()}>Supprimer</button>
                        </div>
                      </td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className='bg-white p-4 rounded shadow'>
                <h3 className='font-semibold mb-3'>Ajouter client</h3>
                <input value={clientForm.name} onChange={e=>setClientForm(f=>({...f, name:e.target.value}))} placeholder='Nom' className='w-full px-2 py-2 border rounded mb-2' />
                <input value={clientForm.email} onChange={e=>setClientForm(f=>({...f, email:e.target.value}))} placeholder='Email' className='w-full px-2 py-2 border rounded mb-2' />
                <input value={clientForm.phone} onChange={e=>setClientForm(f=>({...f, phone:e.target.value}))} placeholder='Téléphone' className='w-full px-2 py-2 border rounded mb-2' />
                <input value={clientForm.address} onChange={e=>setClientForm(f=>({...f, address:e.target.value}))} placeholder='Adresse' className='w-full px-2 py-2 border rounded mb-2' />
                <div className='flex gap-2'><button onClick={saveClientFirestore} className='px-3 py-2 bg-indigo-600 text-white rounded' disabled={!isAdmin()}>Enregistrer</button><button onClick={()=> setClientForm({ id:null, name:'', email:'', phone:'', address:'' })} className='px-3 py-2 border rounded'>Annuler</button></div>
              </div>
            </div>
          )}

          {view === 'invoices' && (
            <div className='grid grid-cols-3 gap-6'>
              <div className='col-span-2 bg-white p-4 rounded shadow'>
                <h3 className='font-semibold mb-3'>{editingInvoice ? 'Modifier facture' : 'Créer facture'}</h3>
                <label>Type</label>
                <select value={invoiceDraft.type} onChange={e=>setInvoiceDraft(d=>({...d, type:e.target.value}))} className='w-full px-2 py-2 border rounded mb-2'>
                  <option value='commercial'>Facture Commerciale</option>
                  <option value='proforma'>Facture Proforma</option>
                </select>
                <label>Client</label>
                <select value={invoiceDraft.clientId || ''} onChange={e=>setInvoiceDraft(d=>({...d, clientId: e.target.value}))} className='w-full px-2 py-2 border rounded mb-2'>
                  <option value=''>-- Choisir client --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <label>Ajouter produit</label>
                <select onChange={e => { if(e.target.value) { const pid = e.target.value; const prod = products.find(p=>p.id===pid||p.id===Number(pid)); if(prod) setInvoiceDraft(d=>({...d, items:[...d.items, { id:Date.now(), productId: prod.id, name: prod.name, qty:1, price: prod.price }]})); e.target.value=''; } }} className='w-full px-2 py-2 border rounded mb-4'>
                  <option value=''>-- Choisir produit --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <label>Date de livraison</label>
                <input type='date' value={invoiceDraft.deliveryDate || ''} onChange={e=>setInvoiceDraft(d=>({...d, deliveryDate: e.target.value}))} className='w-full px-2 py-2 border rounded mb-2' />
                <label>Lieu de livraison</label>
                <input value={invoiceDraft.deliveryAddress || ''} onChange={e=>setInvoiceDraft(d=>({...d, deliveryAddress: e.target.value}))} className='w-full px-2 py-2 border rounded mb-2' />

                <div className='border rounded p-2 mb-3'>
                  {invoiceDraft.items.map(it => (
                    <div key={it.id} className='flex items-center justify-between border-b py-2'>
                      <div><div className='font-semibold'>{it.name}</div><div className='text-sm'>PU: {formatMG(it.price)}</div></div>
                      <div className='flex items-center gap-2'>
                        <input value={it.qty} onChange={e=>setInvoiceDraft(d=>({...d, items: d.items.map(x=> x.id===it.id ? {...x, qty: Number(e.target.value)} : x)}))} type='number' min='1' className='w-20 px-2 py-1 border rounded' />
                        <button onClick={()=> setInvoiceDraft(d=>({...d, items: d.items.filter(x=>x.id!==it.id)}))} className='px-2 py-1 bg-red-500 text-white rounded' disabled={!isAdmin()}>Suppr</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className='flex gap-2'>
                  <button onClick={()=> editingInvoice ? updateInvoiceFirestore() : saveInvoiceFirestore()} className='px-3 py-2 bg-indigo-600 text-white rounded' disabled={!isAdmin()}>{editingInvoice ? 'Enregistrer les modifications' : 'Générer facture'}</button>
                  <button onClick={()=> { resetInvoiceDraft(); setEditingInvoice(false); }} className='px-3 py-2 border rounded'>Annuler</button>
                </div>
              </div>

              <div className='bg-white p-4 rounded shadow'>
                <h3 className='font-semibold mb-3'>Factures</h3>
                <div className='space-y-2'>
                  {invoices.map(inv => { const total = inv.items.reduce((a,b)=>a+(b.qty||0)*(b.price||0),0); return (
                    <div key={inv.id} className='border rounded p-2 flex items-center justify-between'>
                      <div><div className='font-semibold'>{inv.number}</div><div className='text-xs text-gray-500'>{inv.date} • {inv.type}</div></div>
                      <div className='flex items-center gap-2'>
                        <div className='font-semibold'>{formatMG(total)}</div>
                        <button onClick={()=> generateInvoicePDF(inv)} className='px-2 py-1 bg-yellow-600 text-white rounded'>PDF</button>
                        <button onClick={()=> startEditInvoice(inv)} className='px-2 py-1 bg-green-500 text-white rounded' disabled={!isAdmin()}>Modifier</button>
                        <button onClick={()=> editInvoicePayment(inv)} className='px-2 py-1 bg-red-600 text-white rounded' disabled={!isAdmin()}>Paiement</button>
                        <button onClick={()=> deleteInvoiceFirestore(inv.id)} className='px-2 py-1 bg-red-500 text-white rounded' disabled={!isAdmin()}>Supprimer</button>
                      </div>
                    </div>
                  ) })}
                </div>
              </div>
            </div>
          )}

          {view === 'settings' && (
            <div className='bg-white p-4 rounded shadow max-w-xl'>
              <h3 className='font-semibold mb-3'>Paramètres de l'entreprise</h3>
              <div>⚠️ Paramètres sauvegardés localement (option: push to Firestore later)</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
