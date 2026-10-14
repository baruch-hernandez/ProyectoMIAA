import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { obtenerToken, obtenerUsuario } from '../utils/sesion';
import type { UsuarioSesion } from '../utils/sesion';

interface AuthState {
  token: string | null;
  usuario: UsuarioSesion | null;
}

// Arranca con lo guardado para no perder la sesión al recargar
const initialState: AuthState = {
  token: obtenerToken(),
  usuario: obtenerUsuario(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sesionIniciada(state, action: PayloadAction<{ token: string; usuario: UsuarioSesion }>) {
      state.token = action.payload.token;
      state.usuario = action.payload.usuario;
    },
    sesionCerrada(state) {
      state.token = null;
      state.usuario = null;
    },
  },
});

export const { sesionIniciada, sesionCerrada } = authSlice.actions;
export const authReducer = authSlice.reducer;