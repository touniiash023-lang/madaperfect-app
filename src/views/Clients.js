import React from "react";

export default function Clients({ clients, setClients }) {
  const [search, setSearch] = React.useState("");
  const [draft, setDraft] = React.useState({ id: null, name: "", address: "", phone: "" });

  // ⛔ Filtre de recherche
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // ⛔ Enregistrer ou modifier un client
  const saveClient = () => {
    if (!draft.name.trim()) return alert("Nom obligatoire");

    if (draft.id) {
      // 🔄 Modifier
      setClients(clients.map(c => (c.id === draft.id ? draft : c)));
    } else {
      // ➕ Ajouter
      setClients([...clients, { ...draft, id: Date.now() }]);
    }

    setDraft({ id: null, name: "", address: "", phone: "" });
  };

  // ⛔ Supprimer
  const deleteClient = (id) => {
    if (window.confirm("Supprimer ce client ?")) {
      setClients(clients.filter(c => c.id !== id));
    }
  };

  return (
    <div className="p-6">

      <h3 className="text-2xl font-semibold mb-4">Clients</h3>

      {/* 🔍 Recherche */}
      <input
        type="text"
        placeholder="Rechercher..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border p-2 rounded w-full mb-4"
      />

      <div className="grid grid-cols-3 gap-6">

        {/* 📌 Liste des clients */}
        <div className="col-span-2 bg-white p-4 rounded shadow">

          <h4 className="font-semibold mb-3">Liste des clients</h4>

          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-2">Nom</th>
                <th>Email / Adresse</th>
                <th>Téléphone</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-2">{c.name}</td>
                  <td>{c.address}</td>
                  <td>{c.phone}</td>
                  <td className="text-right space-x-2">
                    <button
                      onClick={() => setDraft(c)}
                      className="px-2 py-1 bg-yellow-500 text-white rounded text-sm"
                    >
                      Modifier
                    </button>

                    <button
                      onClick={() => deleteClient(c.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-sm"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>

        {/* ➕ Ajout / Modification */}
        <div className="bg-white p-4 rounded shadow">

          <h4 className="font-semibold mb-3">
            {draft.id ? "Modifier client" : "Ajouter client"}
          </h4>

          <input
            type="text"
            placeholder="Nom"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="border p-2 w-full mb-3 rounded"
          />

          <input
            type="text"
            placeholder="Adresse"
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            className="border p-2 w-full mb-3 rounded"
          />

          <input
            type="text"
            placeholder="Téléphone"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            className="border p-2 w-full mb-3 rounded"
          />

          <div className="flex gap-2">
            <button
              onClick={saveClient}
              className="px-3 py-2 bg-indigo-600 text-white rounded"
            >
              Enregistrer
            </button>

            <button
              onClick={() => setDraft({ id: null, name: "", address: "", phone: "" })}
              className="px-3 py-2 bg-gray-400 text-white rounded"
            >
              Annuler
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
