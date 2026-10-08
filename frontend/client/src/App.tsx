import { Routes, Route, BrowserRouter } from "react-router-dom";
import LoginCard from "./loginCard";
import RegisterCard from "./registerCard";
// import PhaserGame from "./PhaserGame";
import AuthCheck from "./authenticateCheck";
//import { useNavigate } from "react-router-dom";

// const url = 'http://localhost:3000';


export default function App() {
      
  return (
    <BrowserRouter>
        <Routes>
          <Route path="/" element=<AuthCheck/>/>
          <Route path="/login" element=<LoginCard/>/>
          <Route path="/register" element=<RegisterCard/>/>
        </Routes>
    </BrowserRouter>
  )
}
