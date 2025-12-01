import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { FiLogOut } from "react-icons/fi";
import Login from "./Login";
import { auth, db } from "./firebase";
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";

export default function MadaPerfectApp() {
  // auth state comes from localStorage set by Login.js
  const [logged, setLogged] = useState(localStorage.getItem("mp_logged") === "yes");
  const [userRole, setUserRole] = useState(localStorage.getItem("mp_userRole") || null);
  const [userEmail, setUserEmail] = useState(localStorage.getItem("mp_userEmail") || null);

  function logout() {
    localStorage.removeItem("mp_logged");
    localStorage.removeItem("mp_userRole");
    localStorage.removeItem("mp_userEmail");
    setLogged(false);
    setUserRole(null);
    setUserEmail(null);
  }

  // VIEW
  const [view, setView] = useState("dashboard");

  // COMPANY (kept in Firestore too later; for now local editable)
  const [company, setCompany] = useState({
    name: "Mada Perfect",
    nif: "",
    stat: "",
    address: "",
    contact: "",
    logo: ""
  });

  /* ---------------------------
     PRODUCTS (articles) - Firestore collection "articles"
  ----------------------------*/
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [productForm, setProductForm] = useState({ id: null, name: "", price: "", image: "", description: "", link: "" });
  const [editingProduct, setEditingProduct] = useState(false);

  async function loadProducts() {
    const q = await getDocs(collection(db, "articles"));
    const list = q.docs.map(d => ({ id: d.id, ...d.data() }));
    setProducts(list);
  }

  useEffect(() => {
    if (logged) {
      loadProducts();
      loadClients();
      loadInvoices();
    }
  }, [logged]);

  async function saveProductFirestore() {
    if (!productForm.name) return alert("Nom requis");
    if (editingProduct && productForm.id) {
      await updateDoc(doc(db, "articles", productForm.id), {
        name: productForm.name,
        price: productForm.price,
        description: productForm.description,
        image: productForm.image,
        link: productForm.link
      });
    } else {
      await addDoc(collection(db, "articles"), {
        name: productForm.name,
        price: productForm.price,
        description: productForm.description,
        image: productForm.image,
        link: productForm.link
      });
    }
    setProductForm({ id: null, name: "", price: "", image: "", description: "", link: "" });
    setEditingProduct(false);
    await loadProducts();
  }

  function startEditProduct(p) {
    setEditingProduct(true);
    setProductForm(p);
    setView("articles");
  }

  async function deleteProductFirestore(id) {
    if (!confirm("Supprimer cet article ?")) return;
    if (userRole !== "admin") return alert("Action refusée : droits insuffisants");
    await deleteDoc(doc(db, "articles", id));
    loadProducts();
  }

  function handleProductImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setProductForm(p => ({ ...p, image: e.target.result }));
    reader.readAsDataURL(file);
  }

  /* ---------------------------
     CLIENTS
  ----------------------------*/
  const [clients, setClients] = useState([]);
  const [clientForm, setClientForm] = useState({ id: null, name: "", email: "", phone: "", address: "" });

  async function loadClients() {
    const q = await getDocs(collection(db, "clients"));
    setClients(q.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function saveClientFirestore() {
    if (!clientForm.name) return alert("Nom requis");
    if (clientForm.id) {
      await updateDoc(doc(db, "clients", clientForm.id), { ...clientForm });
    } else {
      await addDoc(collection(db, "clients"), { ...clientForm });
    }
    setClientForm({ id: null, name: "", email: "", phone: "", address: "" });
    loadClients();
    setView("clients");
  }

  async function deleteClientFirestore(id) {
    if (!confirm("Supprimer ce client ?")) return;
    if (userRole !== "admin") return alert("Action refusée : droits insuffisants");
    await deleteDoc(doc(db, "clients", id));
    loadClients();
  }

  /* ---------------------------
     INVOICES (factures)
  ----------------------------*/
  const [invoices, setInvoices] = useState([]);
  const [invoiceDraft, setInvoiceDraft] = useState({ id: null, clientId: null, items: [], type: "commercial", date: new Date().toISOString().slice(0,10), deliveryDate: "", deliveryAddress: "", paid: 0, number: "" });
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");

  async function loadInvoices() {
    const q = await getDocs(collection(db, "invoices"));
    setInvoices(q.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  function addItemToDraft(productId) {
    const prod = products.find(p => p.id === productId || String(p.id) === String(productId));
    if (!prod) return;
    setInvoiceDraft(d => ({ ...d, items: [...d.items, { id: Date.now(), productId: prod.id, name: prod.name, qty: 1, price: Number(prod.price || 0) }] }));
  }

  function updateItemQty(itemId, qty) {
    setInvoiceDraft(d => ({ ...d, items: d.items.map(it => it.id === itemId ? { ...it, qty: Number(qty) } : it) }));
  }

  function removeItemFromDraft(itemId) {
    setInvoiceDraft(d => ({ ...d, items: d.items.filter(it => it.id !== itemId) }));
  }

  async function saveInvoiceFirestore() {
    if (!invoiceDraft.clientId) return alert("Sélectionner un client");
    const invToSave = { ...invoiceDraft, number: invoiceDraft.number || `INV-${Date.now()}` };
    const ref = await addDoc(collection(db, "invoices"), invToSave);
    await updateDoc(ref, { id: ref.id });
    loadInvoices();
    setInvoiceDraft({ id: null, clientId: null, items: [], type: "commercial", date: new Date().toISOString().slice(0,10), deliveryDate: "", deliveryAddress: "", paid: 0, number: "" });
    setView("invoices");
  }

  function startEditInvoice(inv) {
    setInvoiceDraft({ ...inv });
    setEditingInvoice(true);
    setView("invoices");
  }

  async function updateInvoiceFirestore() {
    if (!invoiceDraft.id) return alert("Invoice id manquant");
    if (userRole !== "admin" && userRole !== "employe") return alert("Pas de droits");
    await updateDoc(doc(db, "invoices", invoiceDraft.id), { ...invoiceDraft });
    loadInvoices();
    setEditingInvoice(false);
  }

  async function deleteInvoiceFirestore(id) {
    if (!confirm("Supprimer cette facture ?")) return;
    if (userRole !== "admin") return alert("Action refusée : droits insuffisants");
    await deleteDoc(doc(db, "invoices", id));
    loadInvoices();
  }

  async function editInvoicePayment(inv) {
    const nouveauPaiement = Number(prompt("Montant payé par le client (en Ariary) :", inv.paid || 0));
    if (isNaN(nouveauPaiement)) return alert("Montant invalide !");
    await updateDoc(doc(db, "invoices", inv.id), { paid: nouveauPaiement });
    loadInvoices();
    alert("Paiement mis à jour !");
  }

  /* ---------------------------
     UTILITAIRES : format / totals / PDF
  ----------------------------*/
  function formatMG(num) { return Number(num || 0).toLocaleString("fr-FR") + " MGA"; }
  function formatCurrency(n) { return Number(n || 0).toFixed(2); }

  function parsePrice(value) { if (!value) return 0; return Number(String(value).replace(/\D/g, "")) || 0; }

  function generateInvoicePDF(inv) {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    let y = 40; const margin = 20;
    const client = clients.find(c => c.id === inv.clientId);
    if (!client) { alert("Client introuvable"); return; }
    const total = inv.items.reduce((a,b)=>a + (b.qty||0)*parsePrice(b.price),0);
    const paid = inv.paid || 0; const rest = total - paid;
    doc.setFontSize(12); doc.text(company.name || "", margin, y); y+=16;
    doc.text(`NIF : ${company.nif}   STAT : ${company.stat}`, margin, y); y+=16;
    doc.text(`Adresse : ${company.address || ""}`, margin, y); y+=16;
    doc.text(`Contact : ${company.contact || ""}`, margin, y); y+=26;
    doc.setFontSize(16); doc.text(inv.type === "proforma" ? "FACTURE PROFORMA" : "FACTURE COMMERCIALE", margin, y); y+=26;
    doc.setFontSize(11); const leftX = 10, rightX = 300;
    doc.text(`Date facture : ${inv.date}`, leftX, y); doc.text(`Facture No : ${inv.number}`, rightX, y); y+=16;
    doc.text(`Date de livraison : ${inv.deliveryDate || "Non définie"}`, rightX, y); y+=16;
    doc.text(`Lieu de livraison : ${inv.deliveryAddress || "Non défini"}`, rightX, y); y+=20;
    doc.setFontSize(13); doc.text("D o i t :", margin, y); y+=16; doc.setFontSize(12);
    doc.text(client.name, margin, y); y+=16; doc.text(client.address || "", margin, y); y+=16; doc.text(client.phone || "", margin, y); y+=26;
    doc.line(margin, y, 550, y); y+=14;
    doc.text("Quantité", margin, y); doc.text("Désignation", margin + 80, y); doc.text("Prix unitaire", margin + 260, y); doc.text("Montant Total", margin + 400, y); y+=10;
    doc.line(margin, y, 550, y); y+=14;
    inv.items.forEach(item => { const montant = (item.qty || 0) * parsePrice(item.price);
      doc.text(String(item.qty), margin, y); doc.text(item.name, margin + 80, y); doc.text(formatMG(item.price), margin + 260, y); doc.text(formatMG(montant), margin + 390, y); y+=16;
    });
    doc.line(margin, y, 550, y); y+=20;
    doc.text("Total:", margin + 320, y); doc.text(formatMG(total), margin + 390, y); y+=16;
    doc.text("Payé:", margin + 320, y); doc.text(formatMG(paid), margin + 390, y); y+=16;
    doc.text("Reste:", margin + 320, y); doc.text(formatMG(rest), margin + 390, y); y+=26;
    const typeLabel = inv.type === "proforma" ? "Proforma" : "Commerciale";
    const texteFinal = "Arrêtée la présente facture " + typeLabel + " à la somme : " + total + " Ariary";
    doc.text(texteFinal, margin, y); y+=26;
    doc.text("Merci pour votre confiance.", margin, y);
    doc.save((inv.number || "invoice") + ".pdf");
  }

  /* ---------------------------
     FILTERS
  ----------------------------*/
  const filteredProducts = products.filter(p => (p.name || "").toLowerCase().includes((productSearch || "").toLowerCase()));
  const filteredInvoices = invoices.filter(inv => (inv.number || "").toLowerCase().includes((invoiceSearch || "").toLowerCase()));

  /* ---------------------------
     Si pas loggé -> Login component
  ----------------------------*/
  if (!logged) return <Login onLogin={() => { setLogged(true); setUserRole(localStorage.getItem("mp_userRole")); setUserEmail(localStorage.getItem("mp_userEmail")); }} />;

  /* ---------------------------
     RENDER UI
  ----------------------------*/
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      {/* Logout floating */}
      <button onClick={logout} title="Déconnexion" className="fixed top-4 right-4 bg-white shadow-lg p-3 rounded-full z-50">
        <FiLogOut size={20} />
      </button>

      <div className="flex">
        <aside className="w-72 bg-indigo-900 text-white min-h-screen p-6">
          <div className="text-2xl font-bold mb-6">MadaPerfect</div>
          <nav className="space-y-3">
            <button onClick={() => setView("dashboard")} className={`w-full text-left px-3 py-2 rounded ${view==='dashboard' ? 'bg-indigo-700' : ''}`}>Tableau de bord</button>
            <button onClick={() => setView("articles")} className={`w-full text-left px-3 py-2 rounded ${view==='articles' ? 'bg-indigo-700' : ''}`}>Articles</button>
            <button onClick={() => setView("invoices")} className={`w-full text-left px-3 py-2 rounded ${view==='invoices' ? 'bg-indigo-700' : ''}`}>Factures</button>
            <button onClick={() => setView("clients")} className={`w-full text-left px-3 py-2 rounded ${view==='clients' ? 'bg-indigo-700' : ''}`}>Clients</button>
            <button onClick={() => setView("settings")} className={`w-full text-left px-3 py-2 rounded ${view==='settings' ? 'bg-indigo-700' : ''}`}>Paramètres</button>
          </nav>

          <div className="mt-6 text-sm text-indigo-100">Connecté : <strong>{userEmail || "Admin"}</strong></div>
          <div className="text-xs mt-1 text-indigo-200">Rôle : <strong>{userRole}</strong></div>
        </aside>

        <main className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold">{ view === "dashboard" ? "Tableau de bord" : view === "articles" ? "Articles" : view === "invoices" ? "Factures" : view === "clients" ? "Clients" : "Paramètres" }</h1>
            <div className="flex items-center gap-4">
              <input placeholder={view === "invoices" ? "Recherche numéro de facture" : "Recherche..."} value={view === "invoices" ? invoiceSearch : productSearch} onChange={e => view === "invoices" ? setInvoiceSearch(e.target.value) : setProductSearch(e.target.value)} className="px-3 py-2 rounded border" />
              <div className="text-sm text-gray-600">Utilisateur • <strong>{userEmail}</strong></div>
            </div>
          </div>

          {/* Dashboard */}
          {view === "dashboard" && (
            <div>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded shadow"><div className="text-sm text-gray-500">Ventes du jour</div><div className="text-xl font-bold mt-2">0.00 AR</div></div>
                <div className="bg-white p-4 rounded shadow"><div className="text-sm text-gray-500">Ventes du mois</div><div className="text-xl font-bold mt-2">0.00 AR</div></div>
                <div className="bg-white p-4 rounded shadow"><div className="text-sm text-gray-500">Produits</div><div className="text-xl font-bold mt-2">{products.length}</div></div>
                <div className="bg-white p-4 rounded shadow"><div className="text-sm text-gray-500">Factures</div><div className="text-xl font-bold mt-2">{invoices.length}</div></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 bg-white p-4 rounded shadow"><h3 className="font-semibold mb-2">Dernières factures</h3>
                  <table className="w-full text-sm"><thead className="text-left text-gray-500"><tr><th>Numéro</th><th>Date</th><th>Client</th><th>Total</th></tr></thead>
                  <tbody>{invoices.slice().reverse().map(inv => {
                    const total = inv.items.reduce((a,b)=>a+(b.qty||0)*(b.price||0),0);
                    const client = clients.find(c=>c.id===inv.clientId);
                    return <tr key={inv.id} className="border-t"><td className="py-2">{inv.number}</td><td>{inv.date}</td><td>{client?.name}</td><td>{formatCurrency(total)}</td></tr>;
                  })}</tbody></table>
                </div>
                <div className="bg-white p-4 rounded shadow"><h3 className="font-semibold mb-2">Récapitulatif</h3><div>Produits: {products.length}</div><div>Clients: {clients.length}</div><div>Factures: {invoices.length}</div></div>
              </div>
            </div>
          )}

          {/* Articles */}
          {view === "articles" && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-4">Liste des produits</h3>
                <div className="space-y-3">
                  {filteredProducts.map(p => (
                    <div key={p.id} className="flex items-center justify-between border rounded p-3">
                      <div className="flex items-center gap-3">
                        <img src={p.image || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='} alt="" className="w-14 h-14 object-cover rounded"/>
                        <div><div className="font-semibold">{p.name}</div><div className="text-sm">{p.description}</div></div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(p.price)}</div>
                        <div className="flex gap-2 mt-2 justify-end">
                          <button onClick={() => startEditProduct(p)} className="px-3 py-1 bg-yellow-400 rounded text-sm">Modifier</button>
                          <button onClick={() => deleteProductFirestore(p.id)} className="px-3 py-1 bg-red-500 rounded text-sm text-white" disabled={userRole !== "admin"}>{ userRole !== "admin" ? "🔒" : "Supprimer" }</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Ajouter / Modifier produit</h3>
                <div className="space-y-2">
                  <input value={productForm.name} onChange={e=>setProductForm(f=>({...f, name: e.target.value}))} placeholder="Nom du produit" className="w-full px-2 py-2 border rounded" />
                  <input value={productForm.price} onChange={e=>setProductForm(f=>({...f, price: e.target.value}))} placeholder="Prix unitaire" className="w-full px-2 py-2 border rounded" />
                  <input value={productForm.link} onChange={e=>setProductForm(f=>({...f, link: e.target.value}))} placeholder="Lien du produit (optionnel)" className="w-full px-2 py-2 border rounded" />
                  <textarea value={productForm.description} onChange={e=>setProductForm(f=>({...f, description: e.target.value}))} placeholder="Description" className="w-full px-2 py-2 border rounded" />
                  <input type="file" accept="image/*" onChange={e=>handleProductImage(e.target.files[0])} />
                  <div className="flex gap-2">
                    <button onClick={saveProductFirestore} className="px-3 py-2 bg-indigo-600 text-white rounded">{editingProduct ? 'Enregistrer' : 'Ajouter'}</button>
                    <button onClick={() => { setProductForm({ id:null, name:'', price:'', image:'', description:'', link:'' }); setEditingProduct(false); }} className="px-3 py-2 border rounded">Annuler</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clients */}
          {view === "clients" && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Liste des clients</h3>
                <table className="w-full text-sm"><thead className="text-left"><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th></th></tr></thead>
                <tbody>{clients.map(c => <tr key={c.id} className="border-t"><td className="py-2">{c.name}</td><td>{c.email}</td><td>{c.phone}</td><td><div className="flex gap-2"><button onClick={() => { setClientForm(c); setView('clients'); }} className="px-2 py-1 bg-yellow-400 rounded">Modifier</button><button onClick={() => deleteClientFirestore(c.id)} className="px-2 py-1 bg-red-500 text-white rounded" disabled={userRole !== "admin"}>{ userRole !== "admin" ? "🔒" : "Supprimer" }</button></div></td></tr> )}</tbody></table>
              </div>

              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Ajouter client</h3>
                <input value={clientForm.name} onChange={e=>setClientForm(f=>({...f, name: e.target.value}))} placeholder="Nom" className="w-full px-2 py-2 border rounded mb-2" />
                <input value={clientForm.email} onChange={e=>setClientForm(f=>({...f, email: e.target.value}))} placeholder="Email" className="w-full px-2 py-2 border rounded mb-2" />
                <input value={clientForm.phone} onChange={e=>setClientForm(f=>({...f, phone: e.target.value}))} placeholder="Téléphone" className="w-full px-2 py-2 border rounded mb-2" />
                <input value={clientForm.address || ''} onChange={e=>setClientForm(f=>({...f, address: e.target.value}))} placeholder="Adresse du client" className="w-full px-2 py-2 border rounded mb-2" />
                <div className="flex gap-2">
                  <button onClick={saveClientFirestore} className="px-3 py-2 bg-indigo-600 text-white rounded">Enregistrer</button>
                  <button onClick={() => setClientForm({ id:null, name:'', email:'', phone:'', address:'' })} className="px-3 py-2 border rounded">Annuler</button>
                </div>
              </div>
            </div>
          )}

          {/* Invoices */}
          {view === "invoices" && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">{editingInvoice ? 'Modifier facture' : 'Créer facture'}</h3>
                <label className="block">Type</label>
                <select value={invoiceDraft.type} onChange={e=>setInvoiceDraft(d=>({...d, type: e.target.value}))} className="w-full px-2 py-2 border rounded mb-2"><option value="commercial">Facture Commerciale</option><option value="proforma">Facture Proforma</option></select>
                <label>Client</label>
                <select value={invoiceDraft.clientId||''} onChange={e=>setInvoiceDraft(d=>({...d, clientId: e.target.value ? e.target.value : null}))} className="w-full px-2 py-2 border rounded mb-2">
                  <option value="">-- Choisir client --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label>Ajouter produit</label>
                <select onChange={e => { if(e.target.value) addItemToDraft(Number(e.target.value)); e.target.value=''; }} className="w-full px-2 py-2 border rounded mb-4">
                  <option value="">-- Choisir produit --</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <label>Date de livraison</label>
                <input type="date" value={invoiceDraft.deliveryDate || ""} onChange={e=>setInvoiceDraft(d=>({...d, deliveryDate: e.target.value}))} className="w-full px-2 py-2 border rounded mb-2" />
                <label>Lieu de livraison</label>
                <input type="text" placeholder="Ex : Ambatomaro" value={invoiceDraft.deliveryAddress || ""} onChange={e=>setInvoiceDraft(d=>({...d, deliveryAddress: e.target.value}))} className="w-full px-2 py-2 border rounded mb-2" />

                <div className="border rounded p-2 mb-3">{invoiceDraft.items.map(it => (<div key={it.id} className="flex items-center justify-between border-b py-2"><div><div className="font-semibold">{it.name}</div><div className="text-sm">PU: {formatCurrency(it.price)}</div></div><div className="flex items-center gap-2"><input value={it.qty} onChange={e=>updateItemQty(it.id, e.target.value)} type="number" min="1" className="w-20 px-2 py-1 border rounded" /><button onClick={()=>removeItemFromDraft(it.id)} className="px-2 py-1 bg-red-500 text-white rounded">Suppr</button></div></div>))}</div>

                <div className="flex gap-2">
                  {editingInvoice ? (<button onClick={updateInvoiceFirestore} className="px-3 py-2 bg-yellow-600 text-white rounded">Enregistrer les modifications</button>) : (<button onClick={saveInvoiceFirestore} className="px-3 py-2 bg-cyan-600 text-white rounded">Générer facture</button>)}
                  <button onClick={()=>{ setInvoiceDraft({ id:null, clientId:null, items:[], type:'commercial', date:new Date().toISOString().slice(0,10), deliveryDate:'', deliveryAddress:'', paid:0, number:'' }); setEditingInvoice(false); }} className="px-3 py-2 border rounded">Annuler</button>
                </div>
              </div>

              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">Factures</h3>
                <div className="space-y-2">{filteredInvoices.map(inv => {
                  const total = inv.items.reduce((a,b)=>a+(b.qty||0)*(b.price||0),0);
                  return (<div key={inv.id} className="border rounded p-2 flex items-center justify-between"><div><div className="font-semibold">{inv.number}</div><div className="text-xs text-gray-500">{inv.date} • {inv.type}</div></div><div className="flex items-center gap-2"><div className="font-semibold">{formatMG(total)}</div><button onClick={()=>generateInvoicePDF(inv)} className="px-2 py-1 bg-yellow-600 text-white rounded">PDF</button><button onClick={()=>startEditInvoice(inv)} className="px-2 py-1 bg-green-500 text-white rounded">Modifier</button><button onClick={()=>editInvoicePayment(inv)} className="px-2 py-1 bg-red-600 text-white rounded">Paiement</button></div></div>);
                })}</div>
              </div>
            </div>
          )}

          {/* PARAMÈTRES */}
          {view === "settings" && (
            <div className="bg-white p-4 rounded shadow max-w-xl">
              <h3 className="font-semibold mb-3">Paramètres de l'entreprise</h3>
              <input value={company.name || ""} onChange={e=>setCompany(c=>({...c, name:e.target.value}))} placeholder="Nom entreprise" className="w-full px-3 py-2 border rounded mb-2" />
              <input value={company.nif || ""} onChange={e=>setCompany(c=>({...c, nif:e.target.value}))} placeholder="NIF" className="w-full px-3 py-2 border rounded mb-2" />
              <input value={company.stat || ""} onChange={e=>setCompany(c=>({...c, stat:e.target.value}))} placeholder="STAT" className="w-full px-3 py-2 border rounded mb-2" />
              <input value={company.address || ''} onChange={e=>setCompany(c=>({...c, address: e.target.value}))} placeholder="Adresse" className="w-full px-2 py-2 border rounded mb-2" />
              <input value={company.contact || ''} onChange={e=>setCompany(c=>({...c, contact: e.target.value}))} placeholder="Contact" className="w-full px-2 py-2 border rounded mb-2" />
              <label>Logo</label>
              <input type="file" onChange={e=>handleLogoUpload && handleLogoUpload(e.target.files[0])} />
              <div className="flex gap-2 mt-3">
                {role !== "employee" && <button onClick={async () => {
                  // save company params to Firestore (simple approach: store as single doc in 'company', update first doc or create)
                  // Find existing doc
                  const q = await getDocs(collection(db, "company"));
                  if (!q.empty) {
                    const id = q.docs[0].id;
                    await updateDoc(doc(db, "company", id), company);
                  } else {
                    await addDoc(collection(db, "company"), company);
                  }
                  alert("Paramètres enregistrés");
                }} className="px-3 py-2 bg-indigo-600 text-white rounded">Sauvegarder</button>}
                <button onClick={()=>alert("Annulé")} className="px-3 py-2 border rounded">Annuler</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
} // FIN COMPONENT

// -------- STAT CARD --------
function StatCard({ title, value }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xl font-bold mt-2">{value}</div>
    </div>
  );
}
