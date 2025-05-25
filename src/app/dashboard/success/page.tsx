import dynamic from 'next/dynamic';

// Cargar el componente dinámicamente y desactivar el prerenderizado en el servidor
const SuccessPageComponent = dynamic(() => import('../../../components/SuccessPageCompontent'), {
  ssr: false, // Desactiva la prerenderización en el servidor
});

export default SuccessPageComponent;
