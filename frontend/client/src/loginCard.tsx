import { useState } from "react";
import {Link, useNavigate} from "react-router-dom" 

const url = "";

export default function LoginCard() {
    // const [isRegister, setIsRegister] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const navigate = useNavigate();
    const handleChange = (e:any) => {
        const {name, value} = e.target;
        setFormData((prev) => ({ ...prev, [name]: value})) 
    }
    const handleSubmit = async (e:any) => {
        e.preventDefault(); // Prevents full page reload
        // console.log("Submitted Data:", formData);
        console.log("In handle submit.\n");
        try{
            const response = await fetch(url + "/auth/login/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json" // Readies the server for json data
                },
                credentials: "include",
                body: JSON.stringify(formData)
            });

           if(response.ok) {
                console.log("getting data");
                const data = await response.json();
                console.log("got data");
                if(data.code == 1) {
                console.log("Form data submitted lol");
                console.log(response.json);  
                navigate("/", {replace: true});
                }
            }
            else {
                console.log("Submission failed");
            }
        }
        catch(err) {
            console.log("Error at form data post: ", err);
        } 
    };


    return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
  <div className="w-full max-w-md bg-blue-950 rounded-2xl shadow-xl p-8">
    <div className="text-center mb-8">
      <h2 className="text-3xl font-bold text-gray-100 mb-2">Welcome Back</h2>
      <p className="text-sm text-white">Please enter your details to sign in</p>
    </div>

    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="Username" className="block text-sm font-medium text-white mb-2">Username</label>
        <input 
          type="text" 
          id="username" 
          name="username"
          placeholder="username" 
          required
          value={formData.username} 
          onChange={handleChange}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-gray-100 placeholder-gray-400"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label htmlFor="password" className="text-sm font-medium text-white">Password</label>
          <a href="#" className="text-sm font-semibold text-blue-600 hover:text-blue-500 hover:underline transition duration-200">Forgot password?</a>
        </div>
        <input 
          type="password" 
          id="password" 
          name="password"
          placeholder="••••••••" 
          onChange={handleChange}
          value={formData.password}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-gray-100 placeholder-gray-400"
        />
      </div>

      <div className="flex items-center">
        <input 
          type="checkbox" 
          id="remember-me" 
          name="remember-me"
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition duration-200"
        />
        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 select-none">
          Remember me
        </label>
      </div>

      <button 
        type="submit" 
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition duration-200 active:scale-[0.98]"
      >
        Sign In
      </button>
    </form>

    <p className="text-center text-sm text-gray-600 mt-8">
      Don't have an account? 
      <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-500 hover:underline transition duration-200">Sign up</Link>
    </p>
  </div>
</div>
    )
}
