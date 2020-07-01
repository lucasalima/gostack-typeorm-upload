import { getCustomRepository } from 'typeorm';

import AppError from '../errors/AppError';

import TransactionsRepository from '../repositories/TransactionsRepository';

class DeleteTransactionService {
  public async execute(id: string): Promise<void> {
    const transactionRepository = getCustomRepository(TransactionsRepository);

    // Antes de excluir, verifica se a transaction existe.
    const transaction = await transactionRepository.findOne(id);

    // Se não existir, retorna erro.
    if (!transaction) {
      throw new AppError('Transaction does not exist.');
    }

    // Se existir, remove.
    await transactionRepository.remove(transaction);
  }
}

export default DeleteTransactionService;
