import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

export default function Login({ onLogin }) {
  const auth = getAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      if(onLogin) onLogin();
    } catch(err) {
      alert('Erreur: ' + err.message);
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-100'>
      <form onSubmit={handleSubmit} className='bg-white p-6 rounded shadow w-full max-w-sm'>
        <h2 className='text-xl font-bold mb-4'>Se connecter</h2>
        <input className='w-full mb-2 p-2 border rounded' placeholder='Email' value={email} onChange={e=>setEmail(e.target.value)} />
        <input type='password' className='w-full mb-4 p-2 border rounded' placeholder='Mot de passe' value={password} onChange={e=>setPassword(e.target.value)} />
        <button className='w-full bg-indigo-600 text-white p-2 rounded'>Connexion</button>
      </form>
    </div>
  );
}
