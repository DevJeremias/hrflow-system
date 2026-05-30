// src/services/timesheetService.ts

export interface PointRecord {
  id: string;
  type: string;
  time: string;
}

// Simulando um banco de dados temporário na memória
let mockDailyRecords: PointRecord[] = [];

export const timesheetService = {
  
  // Busca os registros que já foram feitos hoje
  async getTodayRecords(): Promise<PointRecord[]> {
    return new Promise((resolve) => {
      // Retorna instantaneamente os dados que estão na memória
      resolve([...mockDailyRecords]);
    });
  },

  // Registra um novo ponto
  async registerPunch(): Promise<PointRecord> {
    return new Promise((resolve, reject) => {
      
      setTimeout(() => {
        const types = ['Entrada', 'Pausa Almoço', 'Retorno Almoço', 'Saída'];
        
        // Se já bateu os 4 pontos, não deixa bater mais (regra de negócio)
        if (mockDailyRecords.length >= 4) {
          return reject(new Error('Jornada diária já concluída.'));
        }

        const nextType = types[mockDailyRecords.length];
        const currentTime = new Date().toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        const newRecord: PointRecord = {
          id: Math.random().toString(),
          type: nextType,
          time: currentTime
        };

        // Salva no nosso "banco de dados" falso
        mockDailyRecords.push(newRecord);

        // Devolve o registro criado para a tela atualizar
        resolve(newRecord);
      }, 1000); // Simulando o tempo de processamento do backend (1 segundo)
      
    });
  }

};