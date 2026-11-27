import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "../components/Layout";
import Login from "../pages/Login";
import Register from "../pages/Register";
import ForgotPassword from "../pages/ForgotPassword";
import Dashboard from "../pages/Dashboard";
import Gastos from "../pages/Gastos";
import Recordatorios from "../pages/Recordatorios";
import Estadisticas from "../pages/Estadisticas";
import Historial from "../pages/Historial";
import Perfil from "../pages/Perfil";
import Privacidad from "../pages/Privacidad";
import Terminos from "../pages/Terminos";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route path="/recuperar" element={<ForgotPassword />} />

      {/* Páginas públicas: se pueden abrir sin iniciar sesión (las pide la configuración de Google) */}
      <Route path="/privacidad" element={<Privacidad />} />
      <Route path="/terminos" element={<Terminos />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/recordatorios" element={<Recordatorios />} />
          <Route path="/estadisticas" element={<Estadisticas />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/perfil" element={<Perfil />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
