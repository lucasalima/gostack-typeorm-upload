import { getCustomRepository, getRepository, In } from 'typeorm';

import fs from 'fs';
import csvParse from 'csv-parse';

import TransactionsRepository from '../repositories/TransactionsRepository';

import Category from '../models/Category';
import Transaction from '../models/Transaction';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    // Faz a leitura do arquivo recebido da rota.
    const contactsReadStream = fs.createReadStream(filePath);

    // Configurações do `csv-parse`.
    const parsers = csvParse({
      from_line: 2,
    });

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    // O `pipe` irá realizar a leitura de cada linha disponível do arquivo CSV.
    const parseCSV = contactsReadStream.pipe(parsers);

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) => {
        // Realiza o `trim()` pois o template do CSV é separado por `, ` (vírgula + espaço).
        return cell.trim();
      });

      // Verifica se os campos foram devidamente preenchidos.
      if (!title || !type || !value) return;

      // Armazena os valores nos Arrays para realizar o cadastro de uma única vez (estratégia: `BOOK INSERT`).
      // Caso fosse realizado um INSERT por linha do CSV, seriam abertas/fechadas N conexões para cada registro.
      categories.push(category);
      transactions.push({
        title,
        type,
        value,
        category,
      });
    });

    // O parseCSV é um evento assíncrono. Logo não seria possível acessar os Arrays (`transactions` e `categories`)
    // antes de finalizar a leitura do arquivo. A implementação da Promise resolve isso.
    await new Promise(resolve => parseCSV.on('end', resolve));

    /**
     * Seria possível reutilizar o `CreateTransactionService` para reutilizar o código de inserção das categorias/transações.
     * Porém, cairia no mesmo problema de realizar um INSERT por linha do CSV. Para resolver isso, será criada uma nova regra de negócio,
     * onde poderá ser inserido N registros de uma única vez (estratégia: `BOOK INSERT`).
     */

    // Verifica se as categorias informadas no arquivo CSV já estão cadastradas.
    const existentCategories = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });

    // Armazena o `title` das categorias que não precisam ser cadastradas novamente.
    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    // Primeiro `filter`: realiza o mapeamento das novas categorias que precisam ser cadastradas.
    // Segundo `filter`: garante que as categorias não ficarão duplicadas. Exemplo: [`Food`, `Food`].
    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    // Realiza o mapeamento de cada categoria e retorna um Object com seu respectivo `title`.
    const newCategories = categoryRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoryRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionRepository.save(createdTransactions);

    // Exclui o arquivo CSV após a importação dos registros.
    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
