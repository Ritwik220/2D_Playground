import {useState} from "react";

export default function LoginCard() {
    const [formData, setFormData] = useState({
  username: '',
  password: ''
});

    const handleChange = (e) => {
        const {name, value} = e.target;
        setFormData((prev) => ({ ...prev, [name]: value})) 
    }
    const handleSubmit = (e) => {
    e.preventDefault(); // Prevents full page reload
    console.log("Submitted Data:", formData);
  };


    return (
    <div class="min-h-screen bg-gray-100 flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
    <div class="text-center mb-8">
      <h2 class="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h2>
      <p class="text-sm text-gray-500">Please enter your details to sign in</p>
    </div>

    <form class="space-y-6" onSubmit={handleSubmit}>
      <div>
        <label for="Username" class="block text-sm font-medium text-gray-700 mb-2">Username</label>
        <input 
          type="text" 
          id="username" 
          name="username"
          placeholder="gay6767" 
          required
          value={formData.username} 
          onChange={handleChange}
          class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-gray-800 placeholder-gray-400"
        />
      </div>

      <div>
        <div class="flex justify-between items-center mb-2">
          <label for="password" class="text-sm font-medium text-gray-700">Password</label>
          <a href="#" class="text-sm font-semibold text-blue-600 hover:text-blue-500 hover:underline transition duration-200">Forgot password?</a>
        </div>
        <input 
          type="password" 
          id="password" 
          name="password"
          placeholder="••••••••" 
          onChange={handleChange}
          value={formData.password}
          required
          class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-gray-800 placeholder-gray-400"
        />
      </div>

      <div class="flex items-center">
        <input 
          type="checkbox" 
          id="remember-me" 
          name="remember-me"
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition duration-200"
        />
        <label for="remember-me" class="ml-2 block text-sm text-gray-600 select-none">
          Remember me for 30 days
        </label>
      </div>

      <button 
        type="submit" 
        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition duration-200 active:scale-[0.98]"
      >
        Sign In
      </button>
    </form>

    <p class="text-center text-sm text-gray-600 mt-8">
      Don't have an account? 
      <a href="#" class="font-semibold text-blue-600 hover:text-blue-500 hover:underline transition duration-200">Sign up</a>
    </p>
  </div>
</div>
    )
}
