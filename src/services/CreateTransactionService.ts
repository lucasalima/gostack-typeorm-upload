import { getCustomRepository, getRepository } from 'typeorm';

import TransactionsRepository from '../repositories/TransactionsRepository';

import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    // Realiza verificação de saldo caso a transação seja `outcome`.
    if (type === 'outcome') {
      const { total } = await transactionRepository.getBalance();

      // Verifica se o saldo `total` é maior que o `value` informado.
      if (total < value) {
        throw new AppError('You do not have enough balance');
      }
    }

    // Verifica se a categoria já está cadastrada.
    let transactionCategory = await categoryRepository.findOne({
      where: {
        title: category,
      },
    });

    // Caso não ache o cadastro da categoria, cria-se a categoria.
    if (!transactionCategory) {
      transactionCategory = categoryRepository.create({ title: category });

      await categoryRepository.save(transactionCategory);
    }

    // Cria a transacão.
    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category: transactionCategory,
    });

    // Salva a transação criada.
    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
