module.exports = function Question(sequelize) {
  var Sequelize = sequelize.constructor;
  var QuestionOption = require('./questionOption.model')(sequelize);
  var QuestionOperand = require('./questionOperand.model')(sequelize);
  var ret =
    sequelize.define('question', {
      question_en: {
        type: Sequelize.STRING
      },
      question_ml: {
        type: Sequelize.STRING
      },
      point: {
        type: Sequelize.INTEGER
      },
      type: {
        type: Sequelize.STRING
      },
      is_percentage_calculation: {
        type: Sequelize.INTEGER
      },
      question_group_id: {
        type: Sequelize.INTEGER
      },
      is_readonly: {
        type: Sequelize.INTEGER
      },
      is_decimal: {
        type: Sequelize.INTEGER
      },
      is_arithmetic: {
        type: Sequelize.INTEGER
      },
      operation_id:{
        type: Sequelize.INTEGER
      },
        operand_id:{
        type: Sequelize.INTEGER
      },
      is_mandatory: {
        type: Sequelize.INTEGER
      },
      is_email: {
        type: Sequelize.INTEGER
      },
      is_phone: {
        type: Sequelize.INTEGER
      },
      is_child_question: {
        type: Sequelize.INTEGER
      },
      is_dependent: {
        type: Sequelize.INTEGER
      },
      dependent_question_id: {
        type: Sequelize.INTEGER
      },
      max: {
        type: Sequelize.INTEGER
      },
      min: {
        type: Sequelize.INTEGER
      },
      error_message: {
        type: Sequelize.STRING
      },
      percentage_configuaration_id: {
        type: Sequelize.INTEGER
      },
      sort_order: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.INTEGER
      },
      created_at: {
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },
      modified_at: {
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },

    }, {
      tableName: 'question',
      timestamps: false

    });

      ret.hasMany(QuestionOption, { foreignKey: 'question_id',sourceKey: 'id',as : 'question_options' });

      ret.hasMany(QuestionOperand, {foreignKey : 'operand_id', sourceKey:'operand_id', as: 'question_operands'})


  return ret;
}
