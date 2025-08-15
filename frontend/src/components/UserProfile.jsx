import useAuthStore from '../store/AuthStore'

function UserProfile() {
    const user = useAuthStore((s) => s.userData); 

    if (!user)  return <div className="text-2xl font-semibold text-slate-50">Please login</div>;

  return (
    <div className='text-2xl font-semibold text-slate-50'>
        Welcome, {user.name}!
    </div>
  )
}

export default UserProfile