import {useState} from "react";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import LoginCard from "./loginCard";
import { RegisterCard } from "./registerCard";

const url = 'http://localhost:3000/';


export default function LoginPage() {
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/" element=<LoginCard/>/>
          <Route path="/register" element=<RegisterCard/>/>
        </Routes>
    </BrowserRouter>
  )
}

