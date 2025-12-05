import React, { useEffect, useState } from "react";
import Login from './Login';
import { app, auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import { FiLogOut } from 'react-icons/fi';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartBarIcon, BanknotesIcon, UsersIcon } from '@heroicons/react/24/solid';
import dayjs from 'dayjs';
import { listenToUserRole } from "./firebase";


export default function App() {
const [previewImage, setPreviewImage] = useState(null);

  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    listenToUserRole((role) => {
      console.log("ROLE UTILISATEUR =", role);
      setUserRole(role);
    });
  }, []);
  // 🔍 Recherche produits
  const [searchClient, setSearchClient] = useState("");
const [searchProduct, setSearchProduct] = useState("");

  const [lightboxImage, setLightboxImage] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'superadmin' or 'commercial'
  const [view, setView] = useState('dashboard');

  // Firestore state
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [productImages, setProductImages] = useState([]);
  // 🔍 Recherche factures
const [searchInvoice, setSearchInvoice] = useState("");
  
const filteredProducts = products.filter(p =>
  p.name?.toLowerCase().includes(searchProduct.toLowerCase()) ||
  p.description?.toLowerCase().includes(searchProduct.toLowerCase())
);




const filteredInvoices = invoices.filter(inv => {
  const client = clients.find(c => c.id === inv.clientId);
  const clientName = client?.name?.toLowerCase() || "";

  return (
    inv.number?.toLowerCase().includes(searchInvoice.toLowerCase()) ||
    inv.date?.toLowerCase().includes(searchInvoice.toLowerCase()) ||
    clientName.includes(searchInvoice.toLowerCase())
  );
});

// 🔍 Recherche clients

const filteredClients = clients.filter(c =>
  c.name?.toLowerCase().includes(searchClient.toLowerCase()) ||
  c.phone?.toLowerCase().includes(searchClient.toLowerCase()) ||
  c.address?.toLowerCase().includes(searchClient.toLowerCase())
);

/* Place ce code juste avant return() */
// 📌 Date helpers
const today = new Date().toISOString().slice(0,10);
const monthKey = new Date().toISOString().slice(0,7);

// 📌 Factures du jour & du mois
const todayInvoices = invoices.filter(inv => inv.date === today);
const monthInvoices = invoices.filter(inv => inv.date?.slice(0,7) === monthKey);

// 📌 Calcul montant total
const calcTotal = inv => inv.items.reduce((s,it)=>s + Number(it.price||0) * Number(it.qty||0), 0);

// 📌 Totaux
const todaySales = todayInvoices.reduce((s,inv)=> s + calcTotal(inv), 0);
const monthSales = monthInvoices.reduce((s,inv)=> s + calcTotal(inv), 0);

// 📌 Impayés
const unpaidCount = invoices.filter(inv => (Number(inv.paid||0) < calcTotal(inv))).length;

// 📌 Ticket moyen
const ticketMoyen = invoices.length
  ? Math.round(invoices.reduce((s,inv)=> s + calcTotal(inv), 0) / invoices.length)
  : 0;

// 📌 Ligne de ventes par jour pour LineChart
const chartData = (() => {
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const map = {};
  for (let i=1;i<=days;i++) map[i]=0;

  invoices.forEach(inv => {
    if (!inv.date) return;
    const d = Number(inv.date.split("-")[2]);
    if (map[d] !== undefined) map[d] += calcTotal(inv);
  });

  return Object.keys(map).map(k=>({ jour: k, montant: map[k] }));
})();

// 📌 Camembert payé / restant
let paidSum = 0, totalSum = 0;
invoices.forEach(inv => {
  const t = calcTotal(inv);
  totalSum += t;
  paidSum += Number(inv.paid || 0);
});
const restSum = totalSum - paidSum;
const pieData = [
  { name: "Payé", value: paidSum },
  { name: "Restant", value: restSum }
];

// 📌 Top produits
const topProducts = (() => {
  const agg = {};
  invoices.forEach(inv => {
    inv.items.forEach(it => {
      const key = it.productId || it.name;
      if (!agg[key]) agg[key] = { name: it.name, qty: 0 };
      agg[key].qty += Number(it.qty || 0);
    });
  });
  return Object.values(agg).sort((a,b)=> b.qty - a.qty).slice(0,6);
})();

  // local forms
  const [productForm, setProductForm] = useState({ id: null, name: '', price: '', description: '', link: '', images: [] });
  const [clientForm, setClientForm] = useState({ id: null, name: '', email: '', phone: '', address: '' });
  const [invoiceDraft, setInvoiceDraft] = useState({ id: null, clientId: null, items: [], type: 'commercial', date: new Date().toISOString().slice(0, 10), deliveryDate: '', deliveryAddress: '', paid: 0, number: '' });
  const [editingInvoice, setEditingInvoice] = useState(false);

  // Auth listener => get role via getIdTokenResult
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setUser(null); setRole(null); return; }
      setUser(u);
      const idTokenResult = await u.getIdTokenResult(true);
      const r = idTokenResult.claims.role || idTokenResult.claims['custom:role'] || null;
      setRole(r);
      // load Firestore data after role known
      loadAll();
    });

      {lightboxImage && (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={() => setLightboxImage(null)}
    >
      <img
        src={lightboxImage}
        className="max-w-3xl max-h-[90vh] rounded shadow-lg"
        alt="big"
      />
    </div>
  )}

    return () => unsub();
  }, []);

    // 📌 1️⃣ Gestion des images : on sauvegarde les fichiers dans un state
async function handleProductImages(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  setProductImages(files); // <-- IMPORTANT : on garde les fichiers ici
}



  async function loadAll() {
    await loadProducts();
    await loadClients();
    await loadInvoices();
  }

  async function loadProducts() {
    const q = await getDocs(collection(db, 'products'));
    setProducts(q.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadClients() {
    const q = await getDocs(collection(db, 'clients'));
    setClients(q.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function loadInvoices() {
    const q = await getDocs(collection(db, 'invoices'));
    setInvoices(q.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // ROLE helpers
  const isAdmin = () => role === 'superadmin' || role === 'admin';
  const isCommercial = () => role === 'commercial';

  // Product CRUD (admin-only for create/update/delete)
  async function saveProductFirestore() {
  if (!productForm.name) return alert("Nom requis");
  if (!isAdmin()) return alert("Action non autorisée (seulement superadmin)");

  const storage = getStorage();
  let imageUrls = [];

  // 🔥 Upload des nouvelles images
  if (productImages && productImages.length > 0) {
    for (let file of productImages) {
      const storageRef = ref(storage, "products/" + Date.now() + "-" + file.name);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      imageUrls.push(url);
    }
  }

  // 🔥 Si on MODIFIE un produit → garder les anciennes images
  if (productForm.images && productForm.images.length > 0) {
    imageUrls = [...productForm.images, ...imageUrls];
  }

  const payload = {
    name: productForm.name,
    price: productForm.price,
    description: productForm.description,
    link: productForm.link,
    images: imageUrls,
  };

  // 🔥 UPDATE ou CREATE selon cas
  if (productForm.id) {
    await updateDoc(doc(db, "products", productForm.id), payload);
  } else {
    const docRef = await addDoc(collection(db, "products"), payload);
    await updateDoc(docRef, { id: docRef.id });
  }

  // reset form
  setProductForm({
    id: null,
    name: "",
    price: "",
    description: "",
    link: "",
    images: [],
  });

  setProductImages([]); // important
  loadProducts();
  alert("Produit enregistré !");
}


  async function deleteProductFirestore(id) {
    if (!isAdmin()) return alert('Action non autorisée');
    if (!confirm('Supprimer cet article ?')) return;
    await deleteDoc(doc(db, 'products', id));
    loadProducts();
  }

  // ➕ Ajouter un client
async function addClientFirestore() {
  if (!clientForm.name) return alert("Nom obligatoire");

  await addDoc(collection(db, "clients"), {
    name: clientForm.name,
    address: clientForm.address || "",
    phone: clientForm.phone || ""
  });

  setClientForm({ id: null, name: "", address: "", phone: "" });
}

  // Clients CRUD (admin-only)
  async function saveClientFirestore() {
    if (!clientForm.name) return alert('Nom requis');
    if (!isAdmin()) return alert('Action non autorisée');
    const payload = { ...clientForm };
    if (clientForm.id) { await updateDoc(doc(db, 'clients', clientForm.id), payload); }
    else { const docRef = await addDoc(collection(db, 'clients'), payload); await updateDoc(docRef, { id: docRef.id }); }
    setClientForm({ id: null, name: '', email: '', phone: '', address: '' });
    loadClients();
  }

  async function deleteClientFirestore(id) {
    if (!isAdmin()) return alert('Action non autorisée');
    if (!confirm('Supprimer ce client ?')) return;
    await deleteDoc(doc(db, 'clients', id));
    loadClients();
  }

  // Invoices: create only admin, update only admin, commercial can only read & PDF
  async function saveInvoiceFirestore() {
    if (!invoiceDraft.clientId) return alert('Sélectionner un client');
    if (!isAdmin()) return alert('Action non autorisée');
    const invToSave = { ...invoiceDraft, number: invoiceDraft.number || `INV-${Date.now()}` };
    const docRef = await addDoc(collection(db, 'invoices'), invToSave);
    await updateDoc(docRef, { id: docRef.id });
    resetInvoiceDraft();
    loadInvoices();
  }

  function startEditInvoice(inv) {
    if (!isAdmin()) return alert('Action non autorisée');
    setInvoiceDraft({ ...inv });
    setEditingInvoice(true);
    setView('invoices');
  }

  async function updateInvoiceFirestore() {
    if (!invoiceDraft.id) return alert('Invoice id manquant');
    if (!isAdmin()) return alert('Action non autorisée');
    await updateDoc(doc(db, 'invoices', invoiceDraft.id), { ...invoiceDraft });
    alert('Facture mise à jour !');
    setEditingInvoice(false);
    resetInvoiceDraft();
    loadInvoices();
  }

  async function deleteInvoiceFirestore(id) {
    if (!isAdmin()) return alert('Action non autorisée');
    if (!confirm('Supprimer cette facture ?')) return;
    await deleteDoc(doc(db, 'invoices', id));
    loadInvoices();
  }

  async function editInvoicePayment(inv) {
    if (!isAdmin()) return alert('Action non autorisée');
    const nouveauPaiement = Number(prompt('Montant payé par le client (en Ariary) :', inv.paid || 0));
    if (isNaN(nouveauPaiement)) return alert('Montant invalide');
    await updateDoc(doc(db, 'invoices', inv.id), { paid: nouveauPaiement });
    loadInvoices();
    alert('Paiement mis à jour !');
  }

  function resetInvoiceDraft() { setInvoiceDraft({ id: null, clientId: null, items: [], type: 'commercial', date: new Date().toISOString().slice(0, 10), deliveryDate: '', deliveryAddress: '', paid: 0, number: '' }); }

  // PDF generation (any role)
// PDF generation (any role)
function parsePrice(value) { 
  if (!value) return 0; 
  return Number(String(value).replace(/\D/g, '')) || 0; 
}

function formatMG(n) {
  const num = Number(n || 0);

  // transforme tous les espaces insécables en espace normal
  return num
    .toLocaleString('fr-FR')
    .replace(/\u00A0/g, ' ')   // ← OBLIGATOIRE
    .replace(/\s+/g, ' ')      // ← sécurité supplémentaire
    + ' MGA';
}

function numberToWordsMG(num) { return String(num); /* simplified */ }

function generateInvoicePDF(inv) {
  if(!inv) return alert("Invoice missing");

  const cPrice = (v) => Number(String(v||'').replace(/[^\d]/g,'')) || 0;
  const fPrice = (v) => formatMG(v);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;

function formatDateFR(isoDate) {
  if (!isoDate) return "";

  const moisFR = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const [year, month, day] = isoDate.split("-");

  return `${day} ${moisFR[Number(month) - 1]} ${year}`;
}


  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(10, 40, 100);
  doc.text("MADA PERFECT IMPORT", margin, y);

  y += 18;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0,0,0);
  doc.text("NIF 50T3775350    STAT 461011120240076695", margin, y);
  y += 14;
  doc.text("Adresse: Lot IAH 50 B Itaosy", margin, y);
  y += 14;
  doc.text("Contact: +261 38 10 889 10", margin, y);

  // Invoice meta
  doc.setFont("helvetica", "bold");
  doc.text("Facture No.", 400, margin + 22);
  doc.setFont("helvetica", "normal");
  doc.text(inv.number || "", 480, margin + 22);

  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(inv.type === "proforma" ? "Facture Proforma" : "Facture Commercial", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(formatDateFR(inv.date) || "", 480, y);


  // Client & delivery block
  y += 26;
  doc.rect(margin, y, 520, 70); // outer
  // left
  doc.rect(margin, y, 260, 70);
  doc.setFont("helvetica","bold");
  doc.text("Doit :", margin + 8, y + 16);
  const client = clients.find(c => c.id === inv.clientId) || {};
  doc.setFont("helvetica","normal");
  doc.text(client.name || "", margin + 18, y + 36);
  doc.text(client.address || "", margin + 18, y + 52);
  // right
  doc.rect(margin + 260, y, 260, 70);
  doc.setFont("helvetica","bold");
  doc.text("Date de Livraison :", margin + 270, y + 16);
  doc.text("Lieu de Livraison :", margin + 270, y + 46);
  doc.setFont("helvetica","normal");
  doc.text(inv.deliveryDate || "", margin + 380, y + 16);
  doc.text(inv.deliveryAddress || "", margin + 380, y + 46);

  // Table header
  y += 96;
  doc.setFillColor(70,130,180);
  doc.rect(margin, y, 520, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255,255,255);
  doc.text("Quantité", margin + 10, y + 15);
  doc.text("Designation", margin + 110, y + 15);
  doc.text("Prix unitaire HT", margin + 300, y + 15);
  doc.text("Montant HT", margin + 415, y + 15);
  doc.setFont("helvetica","normal");
  doc.setTextColor(0,0,0);

  // Products lines
y += 22;
(inv.items || []).forEach((it, idx) => {

  const qty = Number(it.qty || 0);
  const unit = cPrice(it.price);
  const lineTotal = qty * unit;

  // WRAP : texte long pour la description
  const text = doc.splitTextToSize(it.name || "", 170); // ← 170px largeur max

  const lineHeight = 14;
  const textHeight = text.length * lineHeight;

  // Auto-height row : calcule hauteur selon contenu
  const rowHeight = Math.max(22, textHeight + 10);

  // Si page trop basse → nouvelle page
  if (y + rowHeight > 820) {
    doc.addPage();
    y = margin;
  }

  // — Rectangle de la ligne
  doc.rect(margin, y, 520, rowHeight);

  // — Quantité
  doc.text(String(qty) + " Pcs", margin + 10, y + 15);

  // — Désignation (multi-lignes)
  doc.text(text, margin + 110, y + 15);

  // — Prix unitaire
  doc.text(fPrice(unit), margin + 300, y + 15);

  // — Montant total
  doc.text(fPrice(lineTotal), margin + 420, y + 15);

  // Move down
  y += rowHeight;
});


  // Totals box (moved left so it aligns with your red line)
  y += 12;
  const boxX = 350;
  const boxW = 210;
  const split = boxX + 70;
  doc.rect(boxX, y, boxW, 70);
  doc.line(split, y, split, y + 70);

  const total = (inv.items || []).reduce((s,it)=> s + (cPrice(it.price) * Number(it.qty||0)), 0);
  const paid = Number(inv.paid || 0);
  const rest = total - paid;

  doc.setFont("helvetica","bold");
  doc.text("Total", boxX + 10, y + 18);
  doc.text("Payé", boxX + 10, y + 38);
  doc.text("Reste", boxX + 10, y + 58);

  doc.setFont("helvetica","normal");
  doc.text(fPrice(total), split + 10, y + 18, { baseline: "alphabetic" });
  doc.text(fPrice(paid), split + 10, y + 38, { baseline: "alphabetic" });
  doc.text(fPrice(rest), split + 10, y + 58, { baseline: "alphabetic" });

  // Thank you footer
  doc.setFont("helvetica","italic");
  doc.setFontSize(11);
  doc.setTextColor(80,80,80);
  doc.text("Merci pour votre confiance et votre collaboration.", 300, 520, { align: "center" });
  doc.text("MADA PERFECT IMPORT vous remercie !", 300, 535, { align: "center" });

  // save
  doc.save((inv.number || "facture") + ".pdf");
}

  function companyName() { try { return JSON.parse(window.localStorage.getItem('mp_company') || '{"name":"Mada Perfect"}').name; } catch (e) { return 'Mada Perfect'; } }

  // Logout
  async function doLogout() { await signOut(auth); setUser(null); setRole(null); }

  // If not logged show Login
  if (!user) return <Login onLogin={() => { /* no-op */ }} />;

  // UI (keeps same visual structure, with buttons disabled/hidden based on role)
   return (
    <div className='min-h-screen bg-gray-100 font-sans'>
      <button onClick={doLogout} className='fixed top-4 right-4 bg-white p-2 rounded shadow' title='Déconnexion'><FiLogOut /></button>
      <div className='flex'>
        <aside className='w-72 bg-indigo-900 text-white min-h-screen p-6'>
          <h1 className='text-2xl font-bold mb-6 flex items-center gap-2'>Mada Perfect Import</h1>
          <nav className='space-y-3'>
            <button onClick={() => setView('dashboard')} className={`w-full text-left px-3 py-2 rounded ${view === 'dashboard' ? 'bg-indigo-700' : ''}`}>Tableau de bord</button>
            <button onClick={() => setView('articles')} className={`w-full text-left px-3 py-2 rounded ${view === 'articles' ? 'bg-indigo-700' : ''}`}>Articles</button>
            <button onClick={() => setView('invoices')} className={`w-full text-left px-3 py-2 rounded ${view === 'invoices' ? 'bg-indigo-700' : ''}`}>Factures</button>
            <button onClick={() => setView('clients')} className={`w-full text-left px-3 py-2 rounded ${view === 'clients' ? 'bg-indigo-700' : ''}`}>Clients</button>
            <button onClick={() => setView('settings')} className={`w-full text-left px-3 py-2 rounded ${view === 'settings' ? 'bg-indigo-700' : ''}`}>Paramètres</button>
          </nav>
          <div className='mt-6 text-sm'>Connecté: <strong>{user.email}</strong><br />Rôle: <strong>{role}</strong></div>
        </aside>

        <main className='flex-1 p-6'>

          {view === 'dashboard' && (
  <div className="space-y-6">

    {/* --- KPI / CARDS --- */}
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div className="bg-white p-4 rounded-lg shadow flex items-center gap-3">
        <ChartBarIcon className="w-8 h-8 text-indigo-600" />
        <div>
          <div className="text-xs text-gray-500">Ventes aujourd'hui</div>
          <div className="text-lg font-bold">{formatMG(todaySales)}</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow flex items-center gap-3">
        <BanknotesIcon className="w-8 h-8 text-green-600" />
        <div>
          <div className="text-xs text-gray-500">Ventes du mois</div>
          <div className="text-lg font-bold">{formatMG(monthSales)}</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow flex items-center gap-3">
        <UsersIcon className="w-8 h-8 text-yellow-500" />
        <div>
          <div className="text-xs text-gray-500">Clients</div>
          <div className="text-lg font-bold">{clients.length}</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-xs text-gray-500">Factures du jour</div>
        <div className="text-lg font-bold">{todayInvoices.length}</div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-xs text-gray-500">Factures impayées</div>
        <div className="text-lg font-bold">{unpaidCount}</div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-xs text-gray-500">Ticket moyen</div>
        <div className="text-lg font-bold">{formatMG(ticketMoyen)}</div>
      </div>
    </div>


    {/* --- GRAPHIQUE DES VENTES (LINE) --- */}
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="col-span-2 bg-white p-4 rounded shadow">
        <div className="text-lg font-semibold mb-3">Courbe des ventes (mois)</div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#eee" />
              <XAxis dataKey="jour" />
              <YAxis />
              <Tooltip formatter={(v) => formatMG(v)} />
              <Line type="monotone" dataKey="montant" stroke="#4F46E5" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- PIE (PAID/UNPAID) + TOP PRODUCTS --- */}
      <div className="space-y-4">

        {/* PAYÉ / RESTANT */}
        <div className="bg-white p-4 rounded shadow">
          <div className="text-lg font-semibold mb-2">Payé vs Restant</div>
          <div style={{ width: "100%", height: 160 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} innerRadius={40} outerRadius={60} dataKey="value">
                  <Cell fill="#4F46E5" />
                  <Cell fill="#E11D48" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-gray-600">
            {formatMG(paidSum)} payé • {formatMG(restSum)} restant
          </div>
        </div>

        {/* TOP PRODUITS */}
        <div className="bg-white p-4 rounded shadow">
          <div className="text-lg font-semibold mb-2">Top produits (quantité)</div>
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{p.name}</span>
                <span className="font-semibold">{p.qty} pcs</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>

    {/* --- FACTURES DU JOUR --- */}
    <div className="bg-white p-4 rounded shadow">
      <div className="text-lg font-semibold mb-3">Factures aujourd'hui</div>

      {todayInvoices.length === 0 && <div className="text-gray-500 text-sm">Aucune facture aujourd'hui.</div>}

      <div className="space-y-2">
        {todayInvoices.map((inv) => {
          const total = inv.items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
          const clientName = clients.find(c => c.id === inv.clientId)?.name || "Client inconnu";
          return (
            <div key={inv.id} className="flex items-center justify-between border rounded p-2">
              <div>
                <div className="font-semibold">{inv.number}</div>
                <div className="text-xs text-gray-500">{clientName}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-semibold">{formatMG(total)}</div>
                <button className="px-2 py-1 bg-indigo-600 text-white rounded"
                        onClick={() => generateInvoicePDF(inv)}>PDF</button>
                <button className="px-2 py-1 border rounded"
                        onClick={() => startEditInvoice(inv)}>Voir</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>

  </div>
)}

           {/* ---------------------------
   ARTICLES (Produits)
   --------------------------- */}
{/* ---------------------------
   ARTICLES (Produits)
--------------------------- */}
{view === 'articles' && (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

    {/* -------------------------
        LISTE DES PRODUITS
    -------------------------- */}
    <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-gray-200">

      <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
        🛒 Produits disponibles
      </h3>

      {/* 🔍 BARRE DE RECHERCHE PRODUITS */}
      <input
        type="text"
        placeholder="🔍 Rechercher un produit..."
        value={searchProduct}
        onChange={(e) => setSearchProduct(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg mb-6 shadow-sm"
      />

      <div className="space-y-6">

        {filteredProducts.length === 0 && (
          <div className="text-center py-6 text-gray-500 italic">
            Aucun produit trouvé.
          </div>
        )}

        {/* 🔄 LISTE FILTRÉE DES PRODUITS */}
        {filteredProducts.map(p => {

          const imagesArray = Array.isArray(p.images)
            ? p.images
            : p.images
            ? [p.images]
            : [];

          return (
            <div
              key={p.id}
              className="flex items-start justify-between p-4 bg-gray-50 rounded-xl shadow-sm hover:shadow-md transition border border-gray-200"
            >

              {/* LEFT — IMAGE + INFO */}
              <div className="flex gap-4">

                {/* IMAGE GALLERY */}
                <div className="flex flex-col gap-2">
                  {imagesArray.length > 0 ? (
                    imagesArray.slice(0, 3).map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        onError={(e) => (e.target.src = "https://via.placeholder.com/80")}
                        className="w-24 h-24 object-cover rounded-lg shadow cursor-pointer hover:scale-105 transition"
                        alt="product"
                      />
                    ))
                  ) : (
                    <img
                      src="https://via.placeholder.com/80"
                      className="w-24 h-24 object-cover rounded-lg opacity-60"
                      alt="placeholder"
                    />
                  )}
                </div>

                {/* PRODUCT INFO */}
                <div>
                  <h4 className="text-xl font-bold text-gray-800">{p.name}</h4>
                  <p className="text-gray-600 max-w-md mt-1">
                    {p.description || "Aucune description fournie"}
                  </p>

                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 text-sm underline mt-2 inline-block"
                    >
                      Voir lien fournisseur
                    </a>
                  )}
                  {/* 🔥 NOUVEAU : BOUTON POUR VOIR L’IMAGE */}
    {imagesArray.length > 0 && (
  <button
    onClick={() => setPreviewImage(imagesArray[0])}
    className="text-blue-600 underline ml-4"
  >
    Voir image
  </button>
)}

                </div>
              </div>

              {/* RIGHT — PRICE + BUTTONS */}
              <div className="text-right min-w-[140px]">
                <div className="text-xl font-bold text-indigo-700 mb-3">
                  {formatMG(p.price)}
                </div>

                <div className="flex flex-col gap-2">

                  <button
                    onClick={() => {
                      setProductForm({
                        id: p.id,
                        name: p.name || "",
                        price: p.price || "",
                        description: p.description || "",
                        link: p.link || "",
                        images: Array.isArray(p.images)
                          ? p.images.filter((img) => img.startsWith("http"))
                          : [],
                      });
                    }}
                    className="px-3 py-1 text-sm rounded-lg bg-yellow-400 hover:bg-yellow-500 font-semibold shadow"
                    disabled={!isAdmin()}
                  >
                    Modifier
                  </button>

                  <button
                    onClick={() => deleteProductFirestore(p.id)}
                    className="px-3 py-1 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold shadow"
                    disabled={!isAdmin()}
                  >
                    Supprimer
                  </button>

                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>


     {/* -------------------------
        FORMULAIRE AJOUT / EDIT
    -------------------------- */}
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
      <h3 className="text-xl font-bold mb-5">
        {productForm.id ? "Modifier le produit" : "Ajouter un produit"}
      </h3>

      <input
        value={productForm.name}
        onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="Nom du produit"
        className="w-full px-3 py-2 border rounded-lg mb-3"
      />

      <input
        value={productForm.price}
        onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
        placeholder="Prix"
        className="w-full px-3 py-2 border rounded-lg mb-3"
      />

      <textarea
        value={productForm.description}
        onChange={(e) =>
          setProductForm((f) => ({ ...f, description: e.target.value }))
        }
        placeholder="Description"
        className="w-full px-3 py-2 border rounded-lg mb-3 h-28"
      />

      <input
        value={productForm.link}
        onChange={(e) => setProductForm((f) => ({ ...f, link: e.target.value }))}
        placeholder="Lien fournisseur"
        className="w-full px-3 py-2 border rounded-lg mb-3"
      />

      {/* Upload images */}
      <label className="font-semibold text-gray-700">Images :</label>
      <input
        type="file"
        multiple
        onChange={handleProductImages}
        className="w-full px-3 py-2 border rounded-lg mb-3 bg-white"
      />

      {/* Preview images */}
      <div className="flex flex-wrap gap-3 mb-4">
        {(productForm.images || []).map((img, i) => (
          <div key={i} className="relative">
            <img
              src={img}
              className="w-20 h-20 object-cover rounded-lg border shadow"
              alt="preview"
            />
            <button
              onClick={() =>
                setProductForm((f) => ({
                  ...f,
                  images: f.images.filter((_, idx) => idx !== i),
                }))
              }
              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={saveProductFirestore}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 font-semibold"
        >
          Enregistrer
        </button>

        <button
          onClick={() =>
            setProductForm({
              id: null,
              name: "",
              price: "",
              description: "",
              link: "",
              images: [],
            })
          }
          className="px-4 py-2 border rounded-lg shadow-sm"
        >
          Annuler
        </button>
        
      </div>
      
    </div>
  </div>
  
)}

{previewImage && (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
    
    {/* CARD */}
    <div className="bg-white p-4 rounded-lg shadow-xl max-w-3xl w-full relative">
      
      {/* BOUTON FERMER */}
      <button
        onClick={() => setPreviewImage(null)}
        className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
      >
        ✕
      </button>

      {/* IMAGE */}
      <img
        src={previewImage}
        alt="preview"
        className="w-full max-h-[80vh] object-contain rounded"
      />

    </div>

  </div>
)}


{/* ---------------------------
   CLIENTS
   --------------------------- */}
{view === 'clients' && (
  <div className='grid grid-cols-3 gap-6'>
    <div className='col-span-2 bg-white p-4 rounded shadow'>
      <h3 className='font-semibold mb-3'>Liste des clients</h3>
      <input
        type="text"
        placeholder="🔍 Rechercher un client..."
        value={searchClient}
        onChange={(e) => setSearchClient(e.target.value)}
        className="w-full px-3 py-2 border rounded mb-4 shadow-sm"
      />

      <table className='w-full text-sm'>
        <thead><tr><th>Nom</th><th>Adresse</th><th>Téléphone</th><th></th></tr></thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.id} className='border-t'>
              <td>{c.name}</td>
              <td>{c.address}</td>
              <td>{c.phone}</td>
              <td>
                <div className='flex gap-2'>
                  <button onClick={() => setClientForm(c)} className='px-2 py-1 bg-yellow-400 rounded' disabled={!isAdmin()}>Modifier</button>
                  <button onClick={() => deleteClientFirestore(c.id)} className='px-2 py-1 bg-red-500 rounded text-white' disabled={!isAdmin()}>Supprimer</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className='bg-white p-4 rounded shadow'>
      <h3 className='font-semibold mb-3'>Ajouter / Modifier client</h3>
      <input value={clientForm.name} onChange={e=>setClientForm(f=>({...f, name:e.target.value}))} placeholder='Nom' className='w-full px-2 py-2 border rounded mb-2' />
      <input value={clientForm.email} onChange={e=>setClientForm(f=>({...f, email:e.target.value}))} placeholder='Email' className='w-full px-2 py-2 border rounded mb-2' />
      <input value={clientForm.phone} onChange={e=>setClientForm(f=>({...f, phone:e.target.value}))} placeholder='Téléphone' className='w-full px-2 py-2 border rounded mb-2' />
      <input value={clientForm.address} onChange={e=>setClientForm(f=>({...f, address:e.target.value}))} placeholder='Adresse' className='w-full px-2 py-2 border rounded mb-2' />
      <div className='flex gap-2'>
        <button onClick={saveClientFirestore} className='px-3 py-2 bg-indigo-600 text-white rounded' disabled={!isAdmin()}>Enregistrer</button>
        <button onClick={()=> setClientForm({ id:null, name:'', email:'', phone:'', address:'' })} className='px-3 py-2 border rounded'>Annuler</button>
      </div>
    </div>
  </div>
)}



{/* ---------------------------
   FACTURES (Invoices)
   --------------------------- */}
{view === 'invoices' && (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
      <h3 className='font-semibold mb-3'>{editingInvoice ? 'Modifier facture' : 'Créer facture'}</h3>

      <label>Type</label>
      <select value={invoiceDraft.type} onChange={e=>setInvoiceDraft(d=>({...d, type: e.target.value}))} className='w-full px-2 py-2 border rounded mb-2'>
        <option value='commercial'>Facture Commerciale</option>
        <option value='proforma'>Facture Proforma</option>
      </select>

      {/* 🔍 Recherche Client */}
<label>Client</label>
<input
  type="text"
  placeholder="Rechercher un client..."
  value={searchClient || ""}
  onChange={(e) => setSearchClient(e.target.value)}
  className="w-full px-3 py-2 border rounded mb-2"
/>

{/* Résultats filtrés */}
<div className="bg-white border rounded shadow max-h-40 overflow-y-auto mb-4">
  {clients
    .filter(c =>
      c.name.toLowerCase().includes((searchClient || "").toLowerCase())
    )
    .map(c => (
      <div
        key={c.id}
        onClick={() => {
          setInvoiceDraft(d => ({ ...d, clientId: c.id }));
          setSearchClient(c.name); // affiche le nom dans l’input
        }}
        className="px-3 py-2 hover:bg-indigo-100 cursor-pointer"
      >
        {c.name}
      </div>
    ))}
</div>


      <label>Ajouter produit</label>
<input
  type="text"
  placeholder="Rechercher un produit..."
  value={searchProduct || ""}
  onChange={(e) => setSearchProduct(e.target.value)}
  className="w-full px-3 py-2 border rounded mb-2"
/>

<div className="bg-white border rounded shadow max-h-40 overflow-y-auto mb-4">
        {products
    .filter(p =>
      p.name.toLowerCase().includes((searchProduct || "").toLowerCase())
    )
    .map(prod => (
      <div
        key={prod.id}
        onClick={() => {
          setInvoiceDraft(d => ({
            ...d,
            items: [
              ...d.items,
              {
                id: Date.now(),
                productId: prod.id,
                name: prod.name,
                qty: 1,
                price: prod.price
              }
            ]
          }));
          setSearchProduct(""); // vide après sélection
        }}
        className="px-3 py-2 hover:bg-indigo-100 cursor-pointer"
      >
        {prod.name}
      </div>
    ))}
</div>


      <label>Date de livraison</label>
      <input type='date' value={invoiceDraft.deliveryDate || ''} onChange={e=>setInvoiceDraft(d=>({...d, deliveryDate: e.target.value}))} className='w-full px-2 py-2 border rounded mb-2' />
      <label>Lieu de livraison</label>
      <input value={invoiceDraft.deliveryAddress || ''} onChange={e=>setInvoiceDraft(d=>({...d, deliveryAddress: e.target.value}))} className='w-full px-2 py-2 border rounded mb-2' />

      <div className='border rounded p-2 mb-3'>
        {invoiceDraft.items.map(it => (
          <div key={it.id} className='flex items-center justify-between border-b py-2'>
            <div>
              <div className='font-semibold'>{it.name}</div>
              <div className='text-sm'>PU: {formatMG(it.price)}</div>
            </div>
            <div className='flex items-center gap-2'>
              <input value={it.qty} onChange={e=>setInvoiceDraft(d=>({...d, items: d.items.map(x=> x.id===it.id ? {...x, qty: Number(e.target.value)} : x)}))} type='number' min='1' className='w-20 px-2 py-1 border rounded' />
              <button onClick={()=> setInvoiceDraft(d=>({...d, items: d.items.filter(x=>x.id!==it.id)}))} className='px-2 py-1 bg-red-500 text-white rounded' disabled={!isAdmin()}>Suppr</button>
            </div>
          </div>
        ))}
      </div>

      <div className='flex gap-2'>
        <button onClick={()=> editingInvoice ? updateInvoiceFirestore() : saveInvoiceFirestore()} className='px-3 py-2 bg-indigo-600 text-white rounded'>{editingInvoice ? 'Enregistrer les modifications' : 'Générer facture'}</button>
        <button onClick={()=> { resetInvoiceDraft(); setEditingInvoice(false); }} className='px-3 py-2 border rounded'>Annuler</button>
      </div>
    </div>

    <div className='bg-white p-4 rounded shadow'>
      <h3 className='font-semibold mb-3'>Factures</h3>
     {/* 🔍 BARRE DE RECHERCHE FACTURES */}
      <input
        type="text"
        placeholder="🔍 Rechercher une facture..."
        value={searchInvoice}
        onChange={(e) => setSearchInvoice(e.target.value)}
        className="w-full px-3 py-2 border rounded mb-3 shadow-sm"
      />

      <div className='space-y-2'>
        {filteredInvoices.length === 0 && (
          <div className="text-gray-500 text-sm italic">
            Aucune facture trouvée.
          </div>
        )}

        {filteredInvoices.map(inv => {
          const total = (inv.items || []).reduce(
            (s, i) => s + Number(i.price || 0) * Number(i.qty || 0),
            0
          );

          return (
            <div key={inv.id}
              className='border rounded p-2 flex items-center justify-between'>
              
              <div>
                <div className='font-semibold'>{inv.number}</div>
                <div className='text-xs text-gray-500'>{inv.date} • {inv.type}</div>
              </div>

              <div className='flex items-center gap-2'>
                <div className='font-semibold'>{formatMG(total)}</div>

                <button onClick={() => generateInvoicePDF(inv)}
                  className='px-2 py-1 bg-yellow-600 text-white rounded'>
                  PDF
                </button>

                <button onClick={() => startEditInvoice(inv)}
                  className='px-2 py-1 bg-green-500 text-white rounded'
                  disabled={!isAdmin()}>
                  Modifier
                </button>

                <button onClick={() => editInvoicePayment(inv)}
                  className='px-2 py-1 bg-blue-600 text-white rounded'
                  disabled={!isAdmin()}>
                  Paiement
                </button>

                <button onClick={() => deleteInvoiceFirestore(inv.id)}
                  className='px-2 py-1 bg-red-500 text-white rounded'
                  disabled={!isAdmin()}>
                  Supprimer
                </button>
              </div>

            </div>
          );
        })}
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
