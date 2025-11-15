import useAuthStore from '../store/AuthStore'
import deleteSkull from '../assets/deleteSkull.svg'

function UserProfile() {
    const user = useAuthStore((s) => s.userData); 
    const { logout } = useAuthStore()


    const onDeleteAccount = async () => {
      if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;
      const token = localStorage.getItem("token");
      await fetch("http://localhost:8000/account", {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
      });
      logout()
    };


    if (!user)  return <div className="text-2xl font-semibold text-slate-50">Please login</div>;

  return (
    <>
    <div className='text-2xl font-semibold text-slate-50'>
        Welcome, {user.name}!
    </div>
    <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onDeleteAccount}
          className="rounded-xl px-5 py-3 bg-rose-600 text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-400 shadow"
          title="Delete account"
        >
          <img src={deleteSkull} alt="" className="h-6 w-6" />
          <span>Delete account</span>
        </button>
      </div>
    </>
    
  )
}

export default UserProfile


