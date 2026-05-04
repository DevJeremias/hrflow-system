import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, BuildingIcon } from 'lucide-react';
import { 
  saveDepartment, 
  saveRole,
  getDepartments, 
  getRoles, 
  Department, 
  Role 
} from '../../services/departmentsRolesService';
import DepartmentCard from './DepartmentCard';
import RolesTable from './RolesTable';
import FormModal from './FormModal';

const DepartmentsRoles: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'depts' | 'roles'>('depts');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('Todos');

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'department' | 'role';
    item: any;
  }>({
    isOpen: false,
    type: 'department',
    item: null
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptsData, rolesData] = await Promise.all([
        getDepartments(),
        getRoles()
      ]);
      setDepartments(deptsData);
      setRoles(rolesData);
    } catch (error) {
      console.error("Erro ao carregar estrutura organizacional:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRoles = roleFilter === 'Todos' 
    ? roles 
    : roles.filter(r => r.deptSigla === roleFilter);

  const handleOpenModal = (type: 'department' | 'role', item: any = null) => {
    setModalConfig({ isOpen: true, type, item });
  };

  const handleSave = async (data: any) => {
    try {
      console.log(`A guardar ${modalConfig.type}:`, data);
      
      if (modalConfig.type === 'department') {
        await saveDepartment(data);
      } else {
        await saveRole(data);
      }
      
      await loadData();
      
      setModalConfig({ ...modalConfig, isOpen: false });
      
    } catch (error) {
      console.error(error);
      alert("Erro ao processar a operação. Verifique o console.");
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (window.confirm(`Tem a certeza que deseja excluir o cargo "${role.title}"?`)) {
      console.log("A excluir cargo:", role.id);
      await loadData();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Departamentos & Cargos</h1>
          <p className="text-slate-500 font-medium mt-1">Gerencie a hierarquia e os centros de custo da empresa.</p>
        </div>
        <button 
          onClick={() => handleOpenModal(activeTab === 'depts' ? 'department' : 'role')}
          className="group flex items-center gap-3 bg-slate-900 hover:bg-primary text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95"
        >
          <Plus size={22} className="group-hover:rotate-90 transition-transform" />
          <span>Criar {activeTab === 'depts' ? 'Departamento' : 'Cargo'}</span>
        </button>
      </div>

      {/* Alternador de Abas (Tabs) */}
      <div className="inline-flex bg-slate-100/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/50">
        <button 
          onClick={() => { setActiveTab('depts'); setRoleFilter('Todos'); }}
          className={`flex items-center gap-3 px-8 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'depts' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <BuildingIcon size={18} /> Departamentos
        </button>
        <button 
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-3 px-8 py-3 rounded-xl text-sm font-black transition-all ${activeTab === 'roles' ? 'bg-white text-primary shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Briefcase size={18} /> Cargos e Funções
        </button>
      </div>

      {/* Conteúdo Principal */}
      <main className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
            <p className="font-bold">A carregar estrutura...</p>
          </div>
        ) : activeTab === 'depts' ? (
          /* Visão de Departamentos (Cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {departments.map(dept => (
              <DepartmentCard 
                key={dept.id} 
                department={dept} 
                onEdit={() => handleOpenModal('department', dept)} 
              />
            ))}
          </div>
        ) : (
          /* Visão de Cargos (Tabela com Filtros) */
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 pb-2">
              <button 
                onClick={() => setRoleFilter('Todos')}
                className={`px-5 py-2 rounded-full text-xs font-black border transition-all ${roleFilter === 'Todos' ? 'bg-primary border-primary text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:border-primary'}`}
              >
                Todos ({roles.length})
              </button>
              {departments.map(dept => (
                <button 
                  key={dept.id}
                  onClick={() => setRoleFilter(dept.sigla)}
                  className={`px-5 py-2 rounded-full text-xs font-black border transition-all ${roleFilter === dept.sigla ? 'bg-primary border-primary text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:border-primary'}`}
                >
                  {dept.sigla} ({roles.filter(r => r.deptSigla === dept.sigla).length})
                </button>
              ))}
            </div>

            <RolesTable 
              roles={filteredRoles} 
              onEdit={(role) => handleOpenModal('role', role)} 
              onDelete={handleDeleteRole} 
            />
          </div>
        )}
      </main>

      {/* Modal Único para Departamentos e Cargos */}
      {modalConfig.isOpen && (
        <FormModal 
          type={modalConfig.type} 
          item={modalConfig.item}
          departments={departments}
          onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
          onSave={handleSave} 
        />
      )}
    </div>
  );
};

export default DepartmentsRoles;