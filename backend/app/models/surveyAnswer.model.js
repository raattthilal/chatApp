module.exports = function SurveyAnswer(sequelize) {
    var Sequelize = sequelize.constructor;
    // var district = require('./district.model') (sequelize);
    var question = require('./question.model') (sequelize);
    var questionOption = require('./questionOption.model') (sequelize);
    // var categoryRelationship = require('./categoryRelationship.model') (sequelize);

    var ret =
      sequelize.define('surveyAnswer', {
        survey_id: {
          type: Sequelize.INTEGER
        },
        question_id	: {
          type: Sequelize.INTEGER
        },
        question_option_id	: {
          type: Sequelize.INTEGER
        },
        answer: {
          type: Sequelize.STRING
        },
        point: {
          type: Sequelize.FLOAT
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
        tableName: 'survey_answer',
        timestamps: false
  
      });
      ret.belongsTo(questionOption, { foreignKey: 'question_option_id' });
      ret.belongsTo(question, {foreignKey: 'question_id'});
      // ret.belongsTo(district, {foreignKey: 'district_id'});
    //   ret.relations = {
    //     lsgiType:lsgiType,
    //     lsgiBlock:lsgiBlock
    // };
      // ret.belongsTo(lsgi, {foreignKey: 'lsgi_id'});
      // ret.belongsTo(categoryRelationship, {foreignKey: 'category_relationship_id'});
    //   ret.belongsTo(lsgiBlock, {foreignKey: 'lsgi_block_id'});
  
    return ret;
  }
  